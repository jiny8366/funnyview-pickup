#!/usr/bin/env node
/**
 * drizzle/ 마이그레이션 SQL 1개를 대상 DB(prod 등)에 직접 적용.
 *
 * 배경: drizzle/meta 가 0013 에서 깨져 `drizzle-kit migrate` 를 prod 에 쓸 수 없고,
 * 빌드의 DB 단계도 기본 skip(RUN_DB_MIGRATE 잔재)이라 새 마이그레이션이 prod 에
 * 자동 반영되지 않는다(0027 suppliers 누락 사고). 이 스크립트로 파일 단위 적용한다.
 *
 * 사용: DATABASE_URL='<prod 6543 URL>' node scripts/apply-migration.cjs 0030
 *   - 번호(0030) 또는 파일명(0030_xxx.sql) 지정
 *   - '--> statement-breakpoint' 단위로 분할 실행
 *   - 마이그레이션 SQL 은 IF NOT EXISTS / duplicate 가드로 멱등하게 작성할 것
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const arg = process.argv[2];
if (!arg) {
  console.error('사용법: DATABASE_URL=... node scripts/apply-migration.cjs <번호|파일명>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 환경변수가 필요합니다 (대상 DB — prod 는 6543 트랜잭션 풀러).');
  process.exit(1);
}

const dir = path.join(__dirname, '..', 'drizzle');
const file = fs.readdirSync(dir).find((f) => f === arg || f.startsWith(arg + '_')) ;
if (!file || !file.endsWith('.sql')) {
  console.error(`drizzle/ 에서 '${arg}' 마이그레이션을 찾을 수 없습니다.`);
  process.exit(1);
}

const sqlText = fs.readFileSync(path.join(dir, file), 'utf8');
const stmts = sqlText.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10 });
const kill = setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 60_000);

(async () => {
  console.log(`적용 대상: drizzle/${file} (${stmts.length}개 구문)`);
  for (const [i, stmt] of stmts.entries()) {
    try {
      await sql.unsafe(stmt);
      console.log(`  ✓ ${i + 1}/${stmts.length}`);
    } catch (e) {
      console.error(`  ✗ ${i + 1}/${stmts.length}: ${e.message.slice(0, 160)}`);
      console.error('중단 — 실패 구문을 확인하세요(이전 구문은 적용된 상태).');
      process.exit(1);
    }
  }
  clearTimeout(kill);
  await sql.end();
  console.log('✅ 완료');
  process.exit(0);
})();
