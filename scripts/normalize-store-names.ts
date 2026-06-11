/**
 * 픽업가맹점 상호 정규화 — 점명만 저장된 stores.name 을 "지니스 안경 {점명}" 으로 접두.
 * (JINY 지시: 정확한 상호 = "지니스 안경 XXX점")
 *
 * 가역: 롤백 = UPDATE stores SET name = replace(name,'지니스 안경 ','') WHERE name LIKE '지니스 안경%'
 * 멱등: 이미 '지니스 안경' 으로 시작하는 행은 제외.
 *
 * 사용(prod DATABASE_URL 보유 환경 — M3):
 *   npx tsx scripts/normalize-store-names.ts          # dry-run (대상 수·샘플만)
 *   npx tsx scripts/normalize-store-names.ts --apply  # 실제 적용
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL 미설정');
  process.exit(1);
}
const sql = postgres(url, { ssl: 'require', max: 2, prepare: false });
const APPLY = process.argv.includes('--apply');
const PREFIX = '지니스 안경 ';

(async () => {
  const targets = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM stores WHERE name NOT LIKE ${PREFIX + '%'} ORDER BY name`;
  console.log(`접두 대상: ${targets.length}건 (이미 '지니스 안경' 시작인 건 제외)`);
  targets.slice(0, 12).forEach((r) => console.log(`  "${r.name}" → "${PREFIX}${r.name}"`));
  if (targets.length > 12) console.log(`  … 외 ${targets.length - 12}건`);

  if (!APPLY) {
    console.log('\nDRY-RUN. 적용하려면 --apply 플래그.');
    await sql.end();
    return;
  }
  const res = await sql`
    UPDATE stores SET name = ${PREFIX} || name WHERE name NOT LIKE ${PREFIX + '%'}`;
  console.log(`\n✅ 적용 완료: ${res.count}건 → "지니스 안경 {점명}"`);
  await sql.end();
})().catch((e) => {
  console.error('ERR:', (e as Error).message);
  process.exit(1);
});
