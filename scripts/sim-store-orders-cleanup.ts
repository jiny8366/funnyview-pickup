/**
 * 시뮬 정리 — scripts/sim-store-orders.ts 가 생성한 [SIM] 데이터 일괄 삭제.
 *
 * 삭제 대상(라벨 [SIM] / customerNote='[SIM]' 기준):
 *   urgent_purchases(시뮬 주문 연결) → order_items → order_status_history → inventory_movements(시뮬 주문)
 *   → orders(customerNote=[SIM]) → customers([SIM]) + 그 user → store_staff users([SIM]).
 *
 * ⚠️ 재고 원복: 시뮬은 reserve/출고(FIFO 차감)로 재고를 변동시킵니다. 단순 행삭제로는 inventory.quantityOnHand·
 *    inventory_lots.quantityRemaining 가 자동 복구되지 않습니다. 정확한 원복은 M3 가 prod 상태를 보고
 *    ① 출고분 재입고 전표로 보정하거나 ② 시뮬 직전 스냅샷 복원으로 처리하세요(본 스크립트는 시뮬 '주문/계정'만 제거).
 *    => 안전을 위해 시뮬 실행 전 inventory/inventory_lots 스냅샷을 떠두는 것을 강력 권장.
 *
 * 사용: DRY_RUN=1 DOTENV_CONFIG_PATH=.env.local npx tsx scripts/sim-store-orders-cleanup.ts
 *       DRY_RUN=0 ... (실제 삭제)
 */
import 'dotenv/config';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  customers,
  orders,
  urgentPurchases,
  users,
} from '../src/db/schema';

const SIM_TAG = '[SIM]';
const DRY = (process.env.DRY_RUN ?? '1') !== '0';

async function main() {
  console.log(`=== 시뮬 정리 ===  DRY_RUN=${DRY ? 'ON' : 'OFF'}`);

  // 1) 시뮬 주문 id 수집 (customerNote = [SIM])
  const simOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.customerNote, SIM_TAG));
  const orderIds = simOrders.map((o) => o.id);
  console.log(`시뮬 주문: ${orderIds.length}건`);

  // 2) 시뮬 고객/계정
  const simCustomers = await db
    .select({ id: customers.id, userId: customers.userId })
    .from(customers)
    .where(like(customers.name, `${SIM_TAG}%`));
  const simStaff = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.role} = 'store_staff' AND ${users.name} LIKE ${SIM_TAG + '%'}`);
  console.log(`시뮬 고객: ${simCustomers.length} · 시뮬 store_staff: ${simStaff.length}`);

  if (DRY) {
    console.log('※ DRY_RUN — 삭제 안 함. 재고 원복 주의(상단 주석 참조). DRY_RUN=0 으로 실제 삭제.');
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    if (orderIds.length) {
      await tx.delete(urgentPurchases).where(inArray(urgentPurchases.orderId, orderIds));
      // order_items / order_status_history / inventory_movements 는 FK referenceId(=orderId)로 연결.
      // 스키마 FK onDelete 설정에 따라 자동삭제 안 되면 아래를 raw 로 정리(테이블명은 prod 확인).
      await tx.execute(sql`DELETE FROM order_items WHERE order_id IN ${sql`(${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`}`);
      await tx.execute(sql`DELETE FROM order_status_history WHERE order_id IN ${sql`(${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`}`);
      await tx.execute(sql`DELETE FROM inventory_movements WHERE reference_type = 'order' AND reference_id IN ${sql`(${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`}`);
      await tx.delete(orders).where(inArray(orders.id, orderIds));
    }
    // 시뮬 고객 + 연결 user (customers.userId onDelete cascade 라 user 삭제 시 customer 자동삭제될 수 있음)
    const custUserIds = simCustomers.map((c) => c.userId);
    if (simCustomers.length) await tx.delete(customers).where(inArray(customers.id, simCustomers.map((c) => c.id)));
    if (custUserIds.length) await tx.delete(users).where(inArray(users.id, custUserIds));
    if (simStaff.length) await tx.delete(users).where(inArray(users.id, simStaff.map((s) => s.id)));
  });

  console.log('✅ 시뮬 주문/계정 삭제 완료. ⚠️ 재고(quantityOnHand/lots) 원복은 별도 보정 필요(상단 주석).');
  process.exit(0);
}

main().catch((e) => {
  console.error('정리 실패:', e);
  process.exit(1);
});
