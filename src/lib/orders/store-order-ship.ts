import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryMovements, storeOrderItems, storeOrders } from '@/db/schema';
import { consumeLotsForVariant } from '@/lib/inventory-fifo';

/**
 * B2B 발주 배송 처리 — confirmed → shipped 원자 전이 + 본사 FIFO 재고 차감.
 *
 * - variant(도수) 단위 라인: consumeLotsForVariant 로 로트 차감 + on_hand 감소 + movements 기록.
 * - variant_id 없는 레거시 라인(0038 이전 제품단위 발주): 차감 스킵 — skipped 로 보고.
 * - 재고 부족/로트 없음: InventoryError 가 그대로 throw 되어 트랜잭션 전체 롤백
 *   (호출 라우트에서 409 로 매핑 — 입고/급매입 후 재시도 경로 안내).
 * - 행 잠금(FOR UPDATE)으로 이중 배송처리(이중 차감) 방지.
 */
export async function shipStoreOrder(storeOrderId: string): Promise<{
  consumedLines: number;
  skippedLines: number;
}> {
  return db.transaction(async (tx) => {
    const [cur] = await tx
      .select({ status: storeOrders.status })
      .from(storeOrders)
      .where(eq(storeOrders.id, storeOrderId))
      .limit(1)
      .for('update');
    if (!cur) throw new StoreOrderShipError('NOT_FOUND', '발주를 찾을 수 없습니다.');
    if (cur.status !== 'confirmed') {
      throw new StoreOrderShipError(
        'INVALID_TRANSITION',
        `배송 처리는 발주확인(confirmed) 상태에서만 가능합니다. (현재 ${cur.status})`,
      );
    }

    const items = await tx
      .select({
        variantId: storeOrderItems.variantId,
        quantity: storeOrderItems.quantity,
      })
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, storeOrderId));

    let consumedLines = 0;
    let skippedLines = 0;
    for (const it of items) {
      if (!it.variantId) {
        skippedLines += 1; // 레거시 제품단위 라인 — 도수 미상으로 차감 불가
        continue;
      }
      await consumeLotsForVariant(tx, it.variantId, it.quantity);
      await tx.insert(inventoryMovements).values({
        variantId: it.variantId,
        movementType: 'outbound',
        quantity: -it.quantity,
        referenceType: 'store_order',
        referenceId: storeOrderId,
      });
      consumedLines += 1;
    }

    await tx
      .update(storeOrders)
      .set({ status: 'shipped', updatedAt: new Date() })
      .where(eq(storeOrders.id, storeOrderId));

    return { consumedLines, skippedLines };
  });
}

export class StoreOrderShipError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message);
    this.name = 'StoreOrderShipError';
  }
}
