/**
 * 재고관리 0건 복구 — inventory 테이블을 FIFO 로트 잔여수량 기준으로 백필.
 * (JINY 리포트: 픽업서비스 재고관리 검색 시 현재고/안전재고가 안 나옴 →
 *  원인: /api/warehouse/inventory 가 inventory 테이블 기준인데 prod 에 행 부재/불일치)
 *
 * 동작: 확정(confirmed) 입고로트가 있는 variant 별로
 *   - inventory 행 없으면 INSERT (quantityOnHand = 로트 잔여합, safetyStock 0)
 *   - 있으면 quantityOnHand 를 로트 잔여합으로 정렬(예약수량·안전재고는 보존)
 * 멱등: 재실행해도 같은 결과. 가역: 생성행은 variant 기준 식별 가능.
 *
 * 사용(prod DATABASE_URL 보유 환경 — M3):
 *   npx tsx scripts/backfill-inventory-from-lots.ts          # dry-run
 *   npx tsx scripts/backfill-inventory-from-lots.ts --apply  # 적용
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL 미설정');
  process.exit(1);
}
const sql = postgres(url, { ssl: 'require', max: 2, prepare: false });
const APPLY = process.argv.includes('--apply');

(async () => {
  // 진단: 현황 파악
  const [[inv], [lots], [orphan]] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(quantity_on_hand),0)::int AS total FROM inventory`,
    sql`SELECT COUNT(DISTINCT l.variant_id)::int AS variants, COALESCE(SUM(l.quantity_remaining),0)::int AS total
        FROM inventory_lots l JOIN inbound_shipments s ON s.id = l.shipment_id
        WHERE l.quantity_remaining > 0 AND s.status = 'confirmed'`,
    sql`SELECT COUNT(*)::int AS c FROM inventory i LEFT JOIN lens_variants v ON v.id = i.variant_id WHERE v.id IS NULL`,
  ]);
  console.log(`[진단] inventory 행: ${inv.c} (총수량 ${inv.total}) / 로트 보유 variant: ${lots.variants} (잔여합 ${lots.total}) / 고아 inventory(variant 불일치): ${orphan.c}`);

  const missing = await sql`
    SELECT l.variant_id, SUM(l.quantity_remaining)::int AS qty
    FROM inventory_lots l
    JOIN inbound_shipments s ON s.id = l.shipment_id
    LEFT JOIN inventory i ON i.variant_id = l.variant_id
    WHERE l.quantity_remaining > 0 AND s.status = 'confirmed' AND i.id IS NULL
    GROUP BY l.variant_id`;
  const mismatch = await sql`
    SELECT i.variant_id, i.quantity_on_hand, SUM(l.quantity_remaining)::int AS lot_qty
    FROM inventory i
    JOIN inventory_lots l ON l.variant_id = i.variant_id
    JOIN inbound_shipments s ON s.id = l.shipment_id AND s.status = 'confirmed'
    WHERE l.quantity_remaining > 0
    GROUP BY i.variant_id, i.quantity_on_hand
    HAVING i.quantity_on_hand <> SUM(l.quantity_remaining)::int`;
  console.log(`[대상] INSERT 필요(행 없음): ${missing.length} variant / 수량 정렬 필요(불일치): ${mismatch.length} variant`);

  if (!APPLY) {
    console.log('\nDRY-RUN. 적용하려면 --apply.');
    await sql.end();
    return;
  }

  const ins = await sql`
    INSERT INTO inventory (variant_id, quantity_on_hand)
    SELECT l.variant_id, SUM(l.quantity_remaining)::int
    FROM inventory_lots l
    JOIN inbound_shipments s ON s.id = l.shipment_id
    LEFT JOIN inventory i ON i.variant_id = l.variant_id
    WHERE l.quantity_remaining > 0 AND s.status = 'confirmed' AND i.id IS NULL
    GROUP BY l.variant_id`;
  const upd = await sql`
    UPDATE inventory i SET quantity_on_hand = agg.lot_qty, updated_at = now()
    FROM (
      SELECT l.variant_id, SUM(l.quantity_remaining)::int AS lot_qty
      FROM inventory_lots l
      JOIN inbound_shipments s ON s.id = l.shipment_id AND s.status = 'confirmed'
      WHERE l.quantity_remaining > 0
      GROUP BY l.variant_id
    ) agg
    WHERE agg.variant_id = i.variant_id AND i.quantity_on_hand <> agg.lot_qty`;
  console.log(`\n✅ 적용: INSERT ${ins.count} / UPDATE ${upd.count}`);
  const [after] = await sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(quantity_on_hand),0)::int AS total FROM inventory`;
  console.log(`[사후] inventory 행: ${after.c} (총수량 ${after.total}) — 로트 잔여합과 일치해야 정상`);
  await sql.end();
})().catch((e) => {
  console.error('ERR:', (e as Error).message);
  process.exit(1);
});
