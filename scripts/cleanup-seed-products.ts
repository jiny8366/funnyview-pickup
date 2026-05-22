/**
 * 초기 시드 샘플 제품 일괄 삭제 (soft delete).
 *
 * 대상: scripts/seed.ts 에서 생성된 7개 테스트 제품.
 * 실제 카탈로그 import 로 들어온 제품과는 별개 (product_code 가 다름).
 *
 * 사용:
 *   source .env.local; npx tsx scripts/cleanup-seed-products.ts
 *   또는 dry-run:
 *   source .env.local; npx tsx scripts/cleanup-seed-products.ts --dry-run
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import { lenses, lensVariants } from '../src/db/schema';

const SEED_PRODUCT_CODES = [
  'ACU-OAS-1D',
  'BIO-INF-2W',
  'ACU-AST-1D',
  'OLE-CHC-1M',
  'CHR-OO-1D-BR',
  'CHR-VEN-1D-DRIP',
  'CHR-QUI-1D-GB',
];

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}시드 샘플 제품 정리\n`);

  const targets = await db
    .select({
      id: lenses.id,
      productCode: lenses.productCode,
      brand: lenses.brand,
      name: lenses.name,
      deletedAt: lenses.deletedAt,
    })
    .from(lenses)
    .where(inArray(lenses.productCode, SEED_PRODUCT_CODES));

  if (targets.length === 0) {
    console.log('대상 제품을 찾을 수 없습니다.');
    return;
  }

  console.log('대상 제품:');
  for (const t of targets) {
    const status = t.deletedAt ? '(이미 삭제됨)' : '';
    console.log(`  ${t.productCode.padEnd(20)} ${t.brand} ${t.name} ${status}`);
  }

  const liveTargets = targets.filter((t) => !t.deletedAt);
  if (liveTargets.length === 0) {
    console.log('\n이미 모두 삭제 처리되어 있습니다.');
    return;
  }

  const ids = liveTargets.map((t) => t.id);
  const variantCount = await db
    .select({ id: lensVariants.id })
    .from(lensVariants)
    .where(inArray(lensVariants.lensId, ids));

  console.log(`\n삭제 처리 예정: 제품 ${liveTargets.length}개, 도수 ${variantCount.length}개`);

  if (DRY_RUN) {
    console.log('\n--dry-run 모드: 실제 변경 없음.');
    return;
  }

  await db
    .update(lenses)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(inArray(lenses.id, ids));

  await db
    .update(lensVariants)
    .set({ isActive: false, updatedAt: new Date() })
    .where(inArray(lensVariants.lensId, ids));

  console.log(`\n완료: 제품 ${liveTargets.length}개 삭제, 도수 ${variantCount.length}개 비활성화.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
