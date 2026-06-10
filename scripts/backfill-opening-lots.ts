/**
 * [B1 — w1, 보드 #2 / Talk #500·#568·#570] FIFO 개시 로트(opening lot) 백필.
 *
 * 배경: prod 에 레거시 inventory.quantityOnHand 재고는 있으나 inventory_lots(FIFO 로트)가
 *       없어, 주문 출고(markShipped→consumeLotsForVariant)가 "재고부족"으로 throw → 500.
 *       (진단·재현 Talk #500, A패치(409 안전망) 배포완료. 이 B1 은 재고 실복구.)
 *
 * 동작: 각 variant 의 (quantityOnHand − 확정로트 잔여합) = gap > 0 이면, gap 만큼
 *       "개시 입고전표 + 개시 로트"를 생성해 FIFO 원장을 기존 on-hand 에 정합화.
 *       ※ 신규 입고가 아니라 기존 재고의 원장 정합화 → inventory.quantityOnHand 불변(이중계상 금지).
 *         그래서 createInboundShipment(on-hand 증가)를 안 쓰고 전표+로트만 직접 insert.
 *
 * 설계(M3 확정 #570):
 *   - 원가기준 = **실효매입가** = round(standardCost × (1 − 매입할인%/100) − 매입할인액), 0 미만 0.
 *     (raw standardCost 는 현재 전제품 매입할인 10% 라 원가 약 11% 과대 → 실효가 사용. #532)
 *   - 개시일 = **2026-06-01 고정**(실입고보다 과거 → FIFO 가 개시분부터 소진).
 *   - inventory.quantityOnHand 불변.
 *   - 로트 INSERT 는 1000행 청크.
 *
 * 멱등: gap 매 실행 재계산(이미 채워졌으면 gap=0 skip). 전표 invoiceRef='OPENING-BACKFILL' 마커.
 *
 * 안전: 기본 DRY-RUN(요약만). 실제 기록은 APPLY=1. prod DB 백업 후, 한산한 시간에 실행.
 *   검토:   npx tsx scripts/backfill-opening-lots.ts
 *   적용:   APPLY=1 npx tsx scripts/backfill-opening-lots.ts   (DATABASE_URL=대상 prod 6543)
 */
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  inboundShipments,
  inventory,
  inventoryLots,
  lensVariants,
  lenses,
  users,
} from '@/db/schema';

const APPLY = process.env.APPLY === '1';
const OPENING_DATE = process.env.OPENING_DATE ?? '2026-06-01';
const MARKER = 'OPENING-BACKFILL';
const CHUNK = 1000;

/** 실효매입가 = round(std × (1 − 매입할인%/100) − 매입할인액), 음수면 0 */
function effectivePurchaseCost(standardCost: number | null, cost: number | null, pct: number | null, amt: number | null): number {
  const base = standardCost ?? cost ?? 0;
  const eff = Math.round(base * (1 - (pct ?? 0) / 100) - (amt ?? 0));
  return Math.max(0, eff);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log(`[backfill-opening-lots] ${APPLY ? '🟥 APPLY(실기록)' : '🟦 DRY-RUN(미기록)'} · 원가=실효매입가 · 개시일=${OPENING_DATE} · 청크=${CHUNK}`);

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (!admin) throw new Error('admin 사용자가 없습니다 (createdBy 필요)');

  // on-hand>0 인 variant + 제품/원가·할인
  const invRows = await db
    .select({
      variantId: inventory.variantId,
      onHand: inventory.quantityOnHand,
      lensId: lensVariants.lensId,
      standardCost: lenses.standardCost,
      cost: lenses.cost,
      pct: lenses.purchaseDiscountPercent,
      amt: lenses.purchaseDiscountAmount,
    })
    .from(inventory)
    .innerJoin(lensVariants, eq(lensVariants.id, inventory.variantId))
    .innerJoin(lenses, eq(lenses.id, lensVariants.lensId))
    .where(gt(inventory.quantityOnHand, 0));

  if (invRows.length === 0) {
    console.log('on-hand>0 재고 없음 — 작업 없음');
    return;
  }

  // 확정 로트 잔여합 (variant 별)
  const variantIds = invRows.map((r) => r.variantId);
  const lotSums = await db
    .select({ variantId: inventoryLots.variantId, rem: sql<number>`COALESCE(SUM(${inventoryLots.quantityRemaining}), 0)` })
    .from(inventoryLots)
    .innerJoin(inboundShipments, eq(inboundShipments.id, inventoryLots.shipmentId))
    .where(and(eq(inboundShipments.status, 'confirmed'), inArray(inventoryLots.variantId, variantIds)))
    .groupBy(inventoryLots.variantId);
  const remByVariant = new Map(lotSums.map((r) => [r.variantId, Number(r.rem)]));

  // lens 별 gap 묶기
  const byLens = new Map<string, { variantId: string; gap: number; cost: number }[]>();
  let totalGap = 0;
  let zeroCost = 0;
  const samples: string[] = [];
  for (const r of invRows) {
    const gap = Number(r.onHand) - (remByVariant.get(r.variantId) ?? 0);
    if (gap <= 0) continue;
    const cost = effectivePurchaseCost(r.standardCost, r.cost, r.pct, r.amt);
    if (cost === 0) zeroCost++;
    if (!byLens.has(r.lensId)) byLens.set(r.lensId, []);
    byLens.get(r.lensId)!.push({ variantId: r.variantId, gap, cost });
    totalGap += gap;
    if (samples.length < 8) samples.push(`  ${r.variantId.slice(0, 8)} gap=${gap} std=${r.standardCost} pct=${r.pct} amt=${r.amt} → 실효원가=${cost}`);
  }

  const lensCount = byLens.size;
  const variantCount = [...byLens.values()].reduce((s, a) => s + a.length, 0);
  console.log(`대상: 제품 ${lensCount}종 · 도수 ${variantCount}개 · 개시수량 합 ${totalGap}`);
  if (zeroCost > 0) console.log(`⚠ 실효원가 0 인 도수 ${zeroCost}개 (std/할인 미설정) — 정산영향, 확인 필요`);
  console.log('원가 샘플:'); samples.forEach((s) => console.log(s));

  if (!APPLY) {
    console.log('\n[DRY-RUN] 미기록. 변경예정: inbound_shipments + inventory_lots INSERT 만, inventory 불변.');
    console.log('실제 적용: APPLY=1 (prod DB 백업 후).');
    return;
  }

  // === 실제 기록 ===
  let shipN = 0, lotN = 0;
  for (const [lensId, items] of byLens) {
    await db.transaction(async (tx) => {
      const [ship] = await tx
        .insert(inboundShipments)
        .values({
          lensId,
          inboundDate: OPENING_DATE,
          invoiceRef: MARKER,
          note: 'FIFO 개시 로트 백필 (레거시 on-hand 정합화 — 신규입고 아님, 실효매입가)',
          status: 'confirmed',
          confirmedAt: new Date(),
          createdBy: admin.id,
        })
        .returning();
      shipN++;
      for (const part of chunk(items, CHUNK)) {
        await tx.insert(inventoryLots).values(
          part.map((it) => ({ shipmentId: ship.id, variantId: it.variantId, quantityReceived: it.gap, quantityRemaining: it.gap, unitCostIncVat: it.cost })),
        );
        lotN += part.length;
      }
    });
  }
  console.log(`✅ APPLY 완료 — 전표 ${shipN}건 · 로트 ${lotN}행. inventory 불변.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e); process.exit(1); });
