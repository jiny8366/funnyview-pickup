/**
 * 진단 스크립트 — home_sections 데이터가 실제로 prod DB 에 들어있는지 확인.
 * 사용: source .env.local 후 npx tsx scripts/check-home-sections.ts
 */
import 'dotenv/config';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import { homeSections } from '../src/db/schema';

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)\//)?.[1] ?? '?';
  console.log(`\nDB 호스트: ${host}\n`);

  const all = await db.select().from(homeSections);
  console.log(`전체 home_sections: ${all.length}개`);
  for (const r of all) {
    console.log(
      `  ${(r.title ?? '').padEnd(20)} kind=${(r.kind ?? '').padEnd(15)} isActive=${r.isActive} deletedAt=${r.deletedAt ? 'SET' : 'null'} startsAt=${r.startsAt ? 'SET' : 'null'} endsAt=${r.endsAt ? 'SET' : 'null'} sortOrder=${r.sortOrder}`,
    );
  }

  const now = new Date();
  const active = await db
    .select()
    .from(homeSections)
    .where(
      and(
        eq(homeSections.isActive, true),
        isNull(homeSections.deletedAt),
        or(isNull(homeSections.startsAt), sql`${homeSections.startsAt} <= ${now}`),
        or(isNull(homeSections.endsAt), sql`${homeSections.endsAt} >= ${now}`),
      ),
    )
    .orderBy(asc(homeSections.sortOrder), asc(homeSections.createdAt));

  console.log(`\nloadActiveSections 와 동일한 조건으로 조회: ${active.length}개`);
  active.forEach((r) => console.log(`  - ${r.title} (sortOrder=${r.sortOrder})`));
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
