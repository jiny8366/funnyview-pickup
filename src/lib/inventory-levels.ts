import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventory, inventoryMovements, lensVariants } from '@/db/schema';

/**
 * 재고 수준 직접 설정 (리스트 인라인 편집용 — JINY).
 * - onHand: 절대값으로 설정. 차이(delta)를 inventory_movements(adjust)로 기록 — 감사 추적 유지.
 *   ※ 현재고 수정은 권한자(admin) 전용 — 호출 라우트에서 게이트.
 * - safetyStock: 절대값 설정 (FIFO 와 무관, 알람 기준).
 * 행이 없으면 생성(멱등).
 */
export async function setInventoryLevels(input: {
  variantId: string;
  onHand?: number;
  safetyStock?: number;
  byUserId: string;
  note?: string;
}): Promise<{ onHandDelta: number }> {
  const { variantId, onHand, safetyStock, byUserId, note } = input;
  let onHandDelta = 0;

  await db.transaction(async (tx) => {
    const [cur] = await tx
      .select({ id: inventory.id, onHand: inventory.quantityOnHand })
      .from(inventory)
      .where(eq(inventory.variantId, variantId))
      .limit(1)
      .for('update');

    if (!cur) {
      await tx.insert(inventory).values({
        variantId,
        quantityOnHand: onHand ?? 0,
        quantityReserved: 0,
        safetyStock: safetyStock ?? 0,
        reorderPoint: 0,
      });
      onHandDelta = onHand ?? 0;
    } else {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (onHand !== undefined && onHand !== cur.onHand) {
        onHandDelta = onHand - cur.onHand;
        set.quantityOnHand = onHand;
        set.lastCountedAt = new Date();
      }
      if (safetyStock !== undefined) set.safetyStock = safetyStock;
      if (Object.keys(set).length > 1) {
        await tx.update(inventory).set(set).where(eq(inventory.id, cur.id));
      }
    }

    if (onHandDelta !== 0) {
      await tx.insert(inventoryMovements).values({
        variantId,
        movementType: 'adjust',
        quantity: onHandDelta,
        note: note ?? '재고 실사 수정 (인라인)',
        performedBy: byUserId,
      });
    }
  });

  return { onHandDelta };
}

/**
 * 한 제품(lens)의 전체 도수에 안전재고 일괄 설정 (JINY — 헤더 클릭 한번에 셋팅).
 * inventory 행이 없는 도수는 생성(멱등). 현재고는 건드리지 않음.
 * @returns 적용된 도수 수
 */
export async function setSafetyStockForLens(lensId: string, safetyStock: number): Promise<number> {
  return db.transaction(async (tx) => {
    const variantRows = await tx
      .select({ id: lensVariants.id })
      .from(lensVariants)
      .where(eq(lensVariants.lensId, lensId));
    const ids = variantRows.map((v) => v.id);
    if (ids.length === 0) return 0;

    await tx
      .update(inventory)
      .set({ safetyStock, updatedAt: new Date() })
      .where(inArray(inventory.variantId, ids));

    // inventory 행이 없는 도수 생성 (현재고 0)
    const existing = await tx
      .select({ variantId: inventory.variantId })
      .from(inventory)
      .where(inArray(inventory.variantId, ids));
    const have = new Set(existing.map((r) => r.variantId));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await tx.insert(inventory).values(
        missing.map((variantId) => ({
          variantId,
          quantityOnHand: 0,
          quantityReserved: 0,
          safetyStock,
          reorderPoint: 0,
        })),
      );
    }
    return ids.length;
  });
}
