/**
 * `public/products/` 폴더의 이미지 파일들을 스캔하여 drizzle 마이그레이션 생성.
 *
 * 사용법:
 *   1. 브랜드 사이트에서 제품 이미지 다운로드
 *   2. public/products/{productCode}.{jpg,png,webp} 형식으로 저장
 *      예: public/products/BNL-NSBCL-90P.jpg
 *   3. 이 스크립트 실행:
 *        npx tsx scripts/build-product-images-migration.ts
 *   4. 생성된 drizzle/00XX_product_image_paths.sql 와 _journal.json 변경 사항 커밋
 *   5. main push → Vercel 빌드 시 자동 마이그레이션 → imageUrl 컬럼 일괄 업데이트
 *
 * 파일명 규칙:
 *   - {productCode} 와 정확히 일치해야 매칭됨 (대소문자 구분, 확장자 포함)
 *   - productCode 는 admin/products 페이지에서 확인 가능
 *   - 예: BNL-RLGCL-30P.jpg → product_code = 'BNL-RLGCL-30P' 인 row 의 imageUrl 업데이트
 */

import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS_DIR = path.join(process.cwd(), 'public/products');
const DRIZZLE_DIR = path.join(process.cwd(), 'drizzle');
const JOURNAL = path.join(DRIZZLE_DIR, 'meta/_journal.json');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}
interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

function main() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error(`❌ ${PRODUCTS_DIR} 가 존재하지 않습니다. 먼저 폴더 생성 후 이미지를 넣으세요.`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`❌ ${PRODUCTS_DIR} 에 이미지 파일이 없습니다.`);
    console.error(`   브랜드 사이트에서 제품 이미지를 다운받아 {productCode}.{jpg,png,webp} 형식으로 저장하세요.`);
    process.exit(1);
  }

  console.log(`📁 ${files.length} 개 이미지 파일 발견:`);
  for (const f of files) console.log(`   - ${f}`);

  // Journal 읽기 → 다음 마이그레이션 번호 결정
  const journal: Journal = JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  const lastIdx = journal.entries[journal.entries.length - 1].idx;
  const nextIdx = lastIdx + 1;
  const idxStr = String(nextIdx).padStart(4, '0');
  const tag = `${idxStr}_product_image_paths`;
  const sqlFile = path.join(DRIZZLE_DIR, `${tag}.sql`);

  if (fs.existsSync(sqlFile)) {
    console.error(`❌ 이미 존재하는 마이그레이션 파일: ${sqlFile}`);
    console.error(`   기존 파일 삭제 후 재실행하거나, 새 이미지만 추가하세요.`);
    process.exit(1);
  }

  // SQL 생성: 각 파일마다 UPDATE 문 + statement-breakpoint
  const stmts: string[] = [];
  for (const file of files) {
    const productCode = path.parse(file).name; // 확장자 제외
    const publicPath = `/products/${file}`;
    const safeCode = productCode.replace(/'/g, "''");
    const safePath = publicPath.replace(/'/g, "''");
    stmts.push(
      `UPDATE lenses SET image_url = '${safePath}', updated_at = NOW() WHERE product_code = '${safeCode}' AND deleted_at IS NULL;`,
    );
  }
  const sqlContent = stmts.join('\n--> statement-breakpoint\n') + '\n';

  fs.writeFileSync(sqlFile, sqlContent);
  console.log(`✅ 마이그레이션 생성: ${sqlFile}`);

  // Journal entry 추가
  journal.entries.push({
    idx: nextIdx,
    version: '7',
    when: Date.now(),
    tag,
    breakpoints: true,
  });
  fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2) + '\n');
  console.log(`✅ Journal 업데이트: idx=${nextIdx} tag=${tag}`);

  // Snapshot 복사 (no schema change, 이전 snapshot 그대로)
  const prevSnapshot = path.join(DRIZZLE_DIR, `meta/${String(lastIdx).padStart(4, '0')}_snapshot.json`);
  const newSnapshot = path.join(DRIZZLE_DIR, `meta/${idxStr}_snapshot.json`);
  fs.copyFileSync(prevSnapshot, newSnapshot);
  console.log(`✅ Snapshot 복사: ${path.basename(newSnapshot)}`);

  console.log(`\n📝 다음 단계:`);
  console.log(`   1. git add public/products/ drizzle/${tag}.sql drizzle/meta/${idxStr}_snapshot.json drizzle/meta/_journal.json`);
  console.log(`   2. git commit -m "feat: 제품 이미지 ${files.length}개 추가"`);
  console.log(`   3. git push origin main`);
  console.log(`   → Vercel 자동 배포 시 마이그레이션 적용`);
}

main();
