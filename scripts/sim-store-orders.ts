/**
 * 가맹점별 발주·출고 시뮬레이션 (JINY 지시) — 급매입/보충후보 리스트 생성을 위한 출고 볼륨 발생.
 *
 * 목적: 각 가맹점별 가상 계정 + 가맹점당 N건(기본 20)의 '출고(shipped)'를 발생시켜
 *   ① 재고를 안전재고 미만으로 끌어내려 어드민 '매입 관리' 보충후보(출고분+안전미달)를 채우고,
 *   ② (옵션) 일부는 picking 유지 + 급매입(urgent_purchases) 등록으로 레거시 급매입리스트도 채움.
 *
 * ⚠️ W1은 로컬·프로드 어디서도 이 스크립트를 실행/검증할 수 없습니다(DB 접근 차단).
 *    M3가 프로드에서 반드시 ① DRY_RUN=1 로 계획 확인 → ② STORE_LIMIT=1 소량 → ③ 전체 순으로 검증 실행.
 *    실행 시 SIM_SUPPRESS_NOTIFY=1 필수(가짜계정 SMS/카카오 폭주·실사용자 스팸 방지).
 *
 * 사용:
 *   DRY_RUN=1 SIM_SUPPRESS_NOTIFY=1 DOTENV_CONFIG_PATH=.env.local npx tsx scripts/sim-store-orders.ts
 *   DRY_RUN=0 PER_STORE=20 STORE_LIMIT=1 SIM_SUPPRESS_NOTIFY=1 ... (소량 검증)
 *   DRY_RUN=0 PER_STORE=20 URGENT_PER_STORE=2 SIM_SUPPRESS_NOTIFY=1 ... (전체)
 *
 * 환경변수:
 *   DRY_RUN          기본 '1'(쓰기 안 함, 계획만 출력). '0' 이어야 실제 생성.
 *   PER_STORE        가맹점당 출고 건수(기본 20).
 *   URGENT_PER_STORE 가맹점당 급매입(urgent_purchases) 등록 건수(기본 0). >0 이면 그만큼 picking 유지+급매입.
 *   STORE_LIMIT      처리할 가맹점 수 제한(미설정=전체).
 *   SIM_SUPPRESS_NOTIFY '1' 권장(dispatcher 가드).
 *
 * 정리: scripts/sim-store-orders-cleanup.ts (라벨 [SIM] 기준 일괄 삭제 + 재고 원복).
 */
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  customers,
  inventory,
  lensVariants,
  orders,
  stores,
  urgentPurchases,
  users,
} from '../src/db/schema';
import { createOrder, OrderCreationError } from '../src/lib/orders/create-order';
import { markPicking, markShipped } from '../src/lib/orders/transitions';
import { InventoryError } from '../src/lib/inventory-fifo';

const SIM_TAG = '[SIM]';
const DRY = (process.env.DRY_RUN ?? '1') !== '0';
const PER_STORE = Number(process.env.PER_STORE ?? 20);
const URGENT_PER_STORE = Number(process.env.URGENT_PER_STORE ?? 0);
const STORE_LIMIT = process.env.STORE_LIMIT ? Number(process.env.STORE_LIMIT) : undefined;

function log(...a: unknown[]) {
  console.log(...a);
}

async function getPerformerUserId(): Promise<string> {
  // 전이(markPicking/markShipped) 수행자 = 기존 admin 또는 warehouse_staff.
  const u = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['admin', 'warehouse_staff']))
    .limit(1);
  if (!u[0]) throw new Error('수행자(admin/warehouse_staff) 계정이 없습니다.');
  return u[0].id;
}

async function ensureSimCustomer(): Promise<string> {
  // 공용 가상 고객 1명 재사용 (user + customers). 라벨 [SIM].
  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`${customers.name} LIKE ${SIM_TAG + '%'}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  if (DRY) {
    log(`  (DRY) 가상 고객 생성 예정`);
    return 'DRY-CUSTOMER';
  }
  const [u] = await db
    .insert(users)
    .values({ role: 'customer', isActive: true })
    .returning({ id: users.id });
  const [c] = await db
    .insert(customers)
    .values({
      userId: u.id,
      name: `${SIM_TAG} 가상고객`,
      phone: '01000000000', // 가짜 — SIM_SUPPRESS_NOTIFY 로 외부발송 억제 전제
      memberType: 'offline',
    })
    .returning({ id: customers.id });
  return c.id;
}

async function ensureSimStoreAccount(storeId: string, storeName: string, idx: number): Promise<void> {
  // 가맹점별 가상 store_staff 계정 (JINY: 각 가맹점별 가상 아이디). 라벨 [SIM].
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'store_staff'), eq(users.storeId, storeId), sql`${users.name} LIKE ${SIM_TAG + '%'}`))
    .limit(1);
  if (existing[0]) return;
  if (DRY) {
    log(`  (DRY) ${storeName} 가상 store_staff 계정 생성 예정 (sim-store-${idx})`);
    return;
  }
  const pw = await hash('pickup1234!', 10);
  await db.insert(users).values({
    role: 'store_staff',
    storeId,
    isActive: true,
    name: `${SIM_TAG} ${storeName} 담당`,
    username: `sim-store-${idx}`,
    phone: `01099${String(900000 + idx).slice(-6)}`,
    passwordHash: pw,
  } as typeof users.$inferInsert);
}

/** 재고 충분한 변형 풀(가용 onHand-reserved >= 1) — 라운드로빈으로 소진 분산. */
async function stockedVariantPool(): Promise<{ variantId: string; available: number }[]> {
  const rows = await db
    .select({
      variantId: inventory.variantId,
      available: sql<number>`${inventory.quantityOnHand} - ${inventory.quantityReserved}`,
    })
    .from(inventory)
    .innerJoin(lensVariants, eq(lensVariants.id, inventory.variantId))
    .where(sql`${inventory.quantityOnHand} - ${inventory.quantityReserved} >= 1 AND ${lensVariants.isActive} = true`)
    .orderBy(desc(sql`${inventory.quantityOnHand} - ${inventory.quantityReserved}`));
  return rows.map((r) => ({ variantId: r.variantId, available: Number(r.available) }));
}

async function main() {
  log(`=== 가맹점 발주·출고 시뮬 ===  DRY_RUN=${DRY ? 'ON(쓰기안함)' : 'OFF(실제생성)'}  PER_STORE=${PER_STORE}  URGENT_PER_STORE=${URGENT_PER_STORE}  STORE_LIMIT=${STORE_LIMIT ?? '전체'}`);
  if (!DRY && process.env.SIM_SUPPRESS_NOTIFY !== '1') {
    log('⚠️ SIM_SUPPRESS_NOTIFY=1 미설정 — 가짜계정 알림이 실제 발송될 수 있습니다. 중단을 권장합니다.');
  }

  const performer = await getPerformerUserId().catch((e) => {
    log('수행자 조회 실패:', (e as Error).message);
    process.exit(1);
  });

  // 전체 가맹점 로드 (M3: 삭제/비활성 제외 필터가 필요하면 prod 스키마에 맞춰 .where 추가).
  let storeList = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .orderBy(stores.name);
  if (STORE_LIMIT) storeList = storeList.slice(0, STORE_LIMIT);
  log(`대상 가맹점: ${storeList.length}곳`);

  const pool = await stockedVariantPool();
  log(`재고 보유 변형(가용>=1): ${pool.length}종`);
  if (pool.length === 0) {
    log('출고 가능한 재고가 없습니다 — 시뮬 중단.');
    process.exit(1);
  }

  const customerId = await ensureSimCustomer();
  const avail = new Map(pool.map((p) => [p.variantId, p.available]));
  const variantIds = pool.map((p) => p.variantId);
  let cursor = 0;
  const nextVariant = (): string | null => {
    for (let n = 0; n < variantIds.length; n++) {
      const vid = variantIds[(cursor + n) % variantIds.length];
      if ((avail.get(vid) ?? 0) >= 1) {
        cursor = (cursor + n + 1) % variantIds.length;
        return vid;
      }
    }
    return null;
  };

  const summary: { store: string; shipped: number; urgent: number; failed: number }[] = [];

  for (let i = 0; i < storeList.length; i++) {
    const store = storeList[i];
    await ensureSimStoreAccount(store.id, store.name, i + 1);
    let shipped = 0;
    let urgent = 0;
    let failed = 0;

    for (let k = 0; k < PER_STORE; k++) {
      const variantId = nextVariant();
      if (!variantId) {
        failed++;
        continue;
      }
      const makeUrgent = k < URGENT_PER_STORE; // 앞쪽 N건은 급매입(picking 유지)

      if (DRY) {
        if (makeUrgent) urgent++;
        else shipped++;
        avail.set(variantId, (avail.get(variantId) ?? 0) - 1);
        continue;
      }

      try {
        const created = await createOrder({
          customerId,
          pickupStoreId: store.id,
          lines: [{ variantId, eyeSide: 'right', quantity: 1 }],
          customerNote: SIM_TAG,
        });
        avail.set(variantId, (avail.get(variantId) ?? 0) - 1);
        await markPicking(created.id, performer as string);

        if (makeUrgent) {
          // 급매입리스트 채우기 — picking 유지 + urgent_purchases 등록(실물 부족 가정).
          await db.insert(urgentPurchases).values({
            orderId: created.id,
            variantId,
            quantityShort: 1,
            status: 'requested',
            note: `${SIM_TAG} 시뮬 부족분`,
            createdBy: performer as string,
          });
          urgent++;
        } else {
          await markShipped(created.id, performer as string);
          shipped++;
        }
      } catch (e) {
        failed++;
        if (e instanceof OrderCreationError || e instanceof InventoryError) {
          // 재고 부족 등 — 다음 건으로
        } else {
          log(`  [${store.name}] 예외:`, (e as Error).message);
        }
      }
    }
    summary.push({ store: store.name, shipped, urgent, failed });
    log(`  ${store.name.padEnd(22)} 출고 ${shipped} · 급매입 ${urgent} · 실패 ${failed}`);
  }

  const tot = summary.reduce(
    (a, s) => ({ shipped: a.shipped + s.shipped, urgent: a.urgent + s.urgent, failed: a.failed + s.failed }),
    { shipped: 0, urgent: 0, failed: 0 },
  );
  log(`\n=== 합계 ===  출고 ${tot.shipped} · 급매입 ${tot.urgent} · 실패 ${tot.failed}  (가맹점 ${summary.length}곳)`);
  log(DRY ? '※ DRY_RUN — 실제 생성 안 함. 검증되면 DRY_RUN=0 으로 재실행.' : '※ 생성 완료. 정리: scripts/sim-store-orders-cleanup.ts');
  process.exit(0);
}

main().catch((e) => {
  console.error('시뮬 실패:', e);
  process.exit(1);
});
