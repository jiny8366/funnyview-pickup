/**
 * FIFO 재고 라이브러리 (확정 2026-05-22).
 *
 * 입고가가 시점마다 변동되는 환경에서 정확한 수익률 정산을 위해
 * 도수(lens_variant) 단위로 선입선출 원가를 추적.
 *
 * 단위: lens_variants.id (도수 조합 = 제품 × SPH × CYL × AXIS × ADD)
 * 정렬: inboundDate ASC (가장 오래된 로트부터 차감)
 *
 * 참조: docs/spec.json 의 inventoryFifo 섹션
 */
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { db as DB } from '@/db/client';
import {
  inboundShipments,
  inventory,
  inventoryLots,
  inventoryMovements,
} from '@/db/schema';

type Tx = Parameters<Parameters<typeof DB.transaction>[0]>[0];

export interface VariantInboundLine {
  variantId: string;
  quantity: number;
  unitCostIncVat: number;
}

export interface FifoConsumeResult {
  lotId: string;
  consumed: number;
  unitCostIncVat: number;
}

/**
 * FIFO 출고 시 발생하는 운영상 예외 (재고 부족 / 입고 로트 없음).
 * 일반 Error 로 던지면 호출 라우트가 TransitionError 만 잡아 500 이 되므로,
 * 운영자에게 원인·해결경로를 명확히 전달하기 위해 타입화함.
 */
export class InventoryError extends Error {
  constructor(
    public code: 'NO_LOTS' | 'INSUFFICIENT_STOCK',
    message: string,
    public detail: { variantId: string; requested: number; available: number; short: number },
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

// =============================================================
// 입고 (Inbound)
// =============================================================

/**
 * 입고 전표 생성 + 도수별 로트 INSERT + inventory.quantityOnHand 증가 + movements 기록.
 *
 * @param tx        Drizzle transaction
 * @param input     전표 헤더 + 도수별 입고 라인
 * @returns         생성된 shipment 와 lots
 */
export async function createInboundShipment(
  tx: Tx,
  input: {
    lensId: string;
    inboundDate: string; // ISO date string (YYYY-MM-DD)
    supplierId?: string | null;
    invoiceRef?: string | null;
    note?: string | null;
    createdBy: string;
    items: VariantInboundLine[]; // 도수별 수량·단가
    confirm?: boolean; // true 면 즉시 inventory 반영, false 면 draft
  },
): Promise<{
  shipment: typeof inboundShipments.$inferSelect;
  lots: (typeof inventoryLots.$inferSelect)[];
}> {
  if (input.items.length === 0) {
    throw new Error('FIFO: 입고 라인이 비어있습니다');
  }
  for (const it of input.items) {
    if (it.quantity <= 0) throw new Error(`FIFO: 수량은 양수여야 합니다 (variantId=${it.variantId})`);
    if (it.unitCostIncVat < 0) throw new Error(`FIFO: 단가는 0 이상이어야 합니다 (variantId=${it.variantId})`);
  }

  const confirm = input.confirm ?? true;

  // 1. 전표 헤더
  const [shipment] = await tx
    .insert(inboundShipments)
    .values({
      lensId: input.lensId,
      inboundDate: input.inboundDate,
      supplierId: input.supplierId ?? null,
      invoiceRef: input.invoiceRef ?? null,
      note: input.note ?? null,
      status: confirm ? 'confirmed' : 'draft',
      confirmedAt: confirm ? new Date() : null,
      createdBy: input.createdBy,
    })
    .returning();

  // 2. 로트 INSERT (도수별)
  const lots = await tx
    .insert(inventoryLots)
    .values(
      input.items.map((it) => ({
        shipmentId: shipment.id,
        variantId: it.variantId,
        quantityReceived: it.quantity,
        quantityRemaining: it.quantity,
        unitCostIncVat: it.unitCostIncVat,
      })),
    )
    .returning();

  // 3. 미확정(draft) 이면 재고 미반영 — 여기서 종료
  if (!confirm) return { shipment, lots };

  // 4. inventory.quantityOnHand += 수량 (도수별 upsert)
  for (const lot of lots) {
    await tx
      .insert(inventory)
      .values({
        variantId: lot.variantId,
        quantityOnHand: lot.quantityReceived,
      })
      .onConflictDoUpdate({
        target: inventory.variantId,
        set: {
          quantityOnHand: sql`${inventory.quantityOnHand} + ${lot.quantityReceived}`,
          updatedAt: new Date(),
        },
      });
  }

  // 5. inventory_movements 입고 기록
  await tx.insert(inventoryMovements).values(
    lots.map((lot) => ({
      variantId: lot.variantId,
      movementType: 'inbound' as const,
      quantity: lot.quantityReceived,
      lotId: lot.id,
      unitCostSnapshot: lot.unitCostIncVat,
      referenceType: 'inbound',
      referenceId: shipment.id,
      performedBy: input.createdBy,
    })),
  );

  return { shipment, lots };
}

/**
 * draft 전표 확정 (재고 반영).
 * draft 상태일 때만 호출 가능. 이미 confirmed 면 에러.
 */
export async function confirmInboundShipment(
  tx: Tx,
  shipmentId: string,
  performedBy: string,
): Promise<void> {
  const [shipment] = await tx
    .select()
    .from(inboundShipments)
    .where(eq(inboundShipments.id, shipmentId))
    .limit(1);
  if (!shipment) throw new Error(`FIFO: 전표 없음 (${shipmentId})`);
  if (shipment.status !== 'draft') throw new Error(`FIFO: draft 상태가 아님 (${shipment.status})`);

  const lots = await tx
    .select()
    .from(inventoryLots)
    .where(eq(inventoryLots.shipmentId, shipmentId));

  await tx
    .update(inboundShipments)
    .set({ status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(inboundShipments.id, shipmentId));

  for (const lot of lots) {
    await tx
      .insert(inventory)
      .values({ variantId: lot.variantId, quantityOnHand: lot.quantityReceived })
      .onConflictDoUpdate({
        target: inventory.variantId,
        set: {
          quantityOnHand: sql`${inventory.quantityOnHand} + ${lot.quantityReceived}`,
          updatedAt: new Date(),
        },
      });
  }

  await tx.insert(inventoryMovements).values(
    lots.map((lot) => ({
      variantId: lot.variantId,
      movementType: 'inbound' as const,
      quantity: lot.quantityReceived,
      lotId: lot.id,
      unitCostSnapshot: lot.unitCostIncVat,
      referenceType: 'inbound',
      referenceId: shipmentId,
      performedBy,
    })),
  );
}

// =============================================================
// 출고 (Outbound — FIFO 소진)
// =============================================================

/**
 * 도수별 FIFO 소진. inboundDate ASC 정렬로 가장 오래된 로트부터 차감.
 * 여러 로트에 걸쳐 소진될 경우 가중평균 단가를 별도 계산 가능.
 *
 * 호출 측이 트랜잭션 안에서 이 함수를 호출하고, 반환된 결과로
 * order_items.{lotId, unitCost} 와 inventory_movements 를 기록해야 함.
 *
 * @throws 재고 부족 시 에러 (rollback 권장)
 */
export async function consumeLotsForVariant(
  tx: Tx,
  variantId: string,
  qty: number,
): Promise<FifoConsumeResult[]> {
  if (qty <= 0) throw new Error('FIFO: 출고 수량은 양수여야 합니다');

  // 미소진 로트 (FIFO 순서: inboundDate ASC, createdAt ASC 보조)
  const lots = await tx
    .select({
      id: inventoryLots.id,
      quantityRemaining: inventoryLots.quantityRemaining,
      unitCostIncVat: inventoryLots.unitCostIncVat,
      inboundDate: inboundShipments.inboundDate,
    })
    .from(inventoryLots)
    .innerJoin(inboundShipments, eq(inventoryLots.shipmentId, inboundShipments.id))
    .where(
      and(
        eq(inventoryLots.variantId, variantId),
        gt(inventoryLots.quantityRemaining, 0),
        eq(inboundShipments.status, 'confirmed'),
      ),
    )
    .orderBy(asc(inboundShipments.inboundDate), asc(inventoryLots.createdAt));

  const results: FifoConsumeResult[] = [];
  let remaining = qty;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const consume = Math.min(lot.quantityRemaining, remaining);
    results.push({
      lotId: lot.id,
      consumed: consume,
      unitCostIncVat: lot.unitCostIncVat,
    });
    remaining -= consume;
  }

  if (remaining > 0) {
    const available = qty - remaining; // 로트로 충당 가능한 수량
    if (lots.length === 0) {
      // 표시 재고(레거시 inventory)는 있어도 확정 입고 로트가 없으면 출고 불가.
      // 운영자 해결경로: 해당 도수의 입고(전표) 등록 → confirmed 후 재시도.
      throw new InventoryError(
        'NO_LOTS',
        '출고 가능한 입고 로트가 없습니다. 해당 도수의 입고(전표)를 등록·확정한 뒤 다시 출고하세요.',
        { variantId, requested: qty, available, short: remaining },
      );
    }
    throw new InventoryError(
      'INSUFFICIENT_STOCK',
      `FIFO 재고가 부족합니다. (요청 ${qty} / 출고가능 ${available} / 부족 ${remaining})`,
      { variantId, requested: qty, available, short: remaining },
    );
  }

  // 로트별 잔여 차감 + inventory.quantityOnHand 감소
  let totalConsumed = 0;
  for (const r of results) {
    await tx
      .update(inventoryLots)
      .set({ quantityRemaining: sql`${inventoryLots.quantityRemaining} - ${r.consumed}` })
      .where(eq(inventoryLots.id, r.lotId));
    totalConsumed += r.consumed;
  }
  await tx
    .update(inventory)
    .set({
      quantityOnHand: sql`${inventory.quantityOnHand} - ${totalConsumed}`,
      updatedAt: new Date(),
    })
    .where(eq(inventory.variantId, variantId));

  return results;
}

/**
 * 가중평균 단가 — 한 주문 라인이 여러 로트에 걸칠 때 order_items.unitCost 산정용.
 */
export function weightedAvgCost(consumes: FifoConsumeResult[]): number {
  if (consumes.length === 0) return 0;
  const total = consumes.reduce((s, c) => s + c.consumed, 0);
  if (total === 0) return 0;
  const sum = consumes.reduce((s, c) => s + c.consumed * c.unitCostIncVat, 0);
  return Math.round(sum / total);
}

// =============================================================
// 조회
// =============================================================

/**
 * variantId 의 FIFO 요약: 잔여 수량/가중평균 단가/가장 오래된 입고일.
 */
export async function getLotSummary(
  tx: Tx,
  variantId: string,
): Promise<{
  totalQty: number;
  weightedAvgCost: number;
  oldestInboundDate: string | null;
  lotCount: number;
}> {
  const lots = await tx
    .select({
      quantityRemaining: inventoryLots.quantityRemaining,
      unitCostIncVat: inventoryLots.unitCostIncVat,
      inboundDate: inboundShipments.inboundDate,
    })
    .from(inventoryLots)
    .innerJoin(inboundShipments, eq(inventoryLots.shipmentId, inboundShipments.id))
    .where(
      and(
        eq(inventoryLots.variantId, variantId),
        gt(inventoryLots.quantityRemaining, 0),
        eq(inboundShipments.status, 'confirmed'),
      ),
    );

  if (lots.length === 0) {
    return { totalQty: 0, weightedAvgCost: 0, oldestInboundDate: null, lotCount: 0 };
  }

  const totalQty = lots.reduce((s, l) => s + l.quantityRemaining, 0);
  const sum = lots.reduce((s, l) => s + l.quantityRemaining * l.unitCostIncVat, 0);
  const oldest = lots
    .map((l) => l.inboundDate)
    .sort()
    .filter((d): d is string => d != null)[0] ?? null;

  return {
    totalQty,
    weightedAvgCost: totalQty > 0 ? Math.round(sum / totalQty) : 0,
    oldestInboundDate: oldest,
    lotCount: lots.length,
  };
}
