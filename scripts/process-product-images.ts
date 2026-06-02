/**
 * 상품 대표이미지 자동 파이프라인 (M1 수작업 제거용).
 *
 * 워크플로:
 *   1) M1: 제조사 공식 이미지를  scripts/product-images-src/{productCode}.{png|jpg|jpeg|webp}  로 넣기(편집 불필요).
 *   2) M3: 이 스크립트 실행 → sips 로 600x600 흰배경 정사각 규격화 → public/products/{productCode}.jpg
 *          → Supabase lenses.image_url = '/products/{productCode}.jpg' 일괄 적용(존재하는 제품만).
 *
 * 사용:
 *   npx tsx scripts/process-product-images.ts                 # 기본 소스폴더, 이미지+DB
 *   npx tsx scripts/process-product-images.ts <srcDir>        # 소스폴더 지정
 *   npx tsx scripts/process-product-images.ts --skip-db       # 이미지 규격화만(DB 미적용)
 *   npx tsx scripts/process-product-images.ts --dry-run       # 미리보기(파일·DB 변경 없음)
 *
 * 요구: macOS `sips` (기본 내장). DB 적용엔 DATABASE_URL(Supabase) 필요.
 * idempotent — 같은 이미지 다시 돌려도 결과 동일.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { lenses } from '../src/db/schema';

const SIZE = 600;
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic']);

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const SKIP_DB = args.includes('--skip-db');
const srcDir = args.find((a) => !a.startsWith('--')) ?? join(__dirname, 'product-images-src');
const outDir = join(__dirname, '..', 'public', 'products');

function squareThumbnail(input: string, output: string) {
  // -Z: 긴 변 600 으로 리샘플(비율 유지) → --padToHeightWidth: 600x600 흰배경 패딩 → jpeg
  execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-Z', String(SIZE),
    '--padToHeightWidth', String(SIZE), String(SIZE),
    '--padColor', 'FFFFFF',
    input,
    '--out', output,
  ], { stdio: 'ignore' });
}

async function main() {
  if (!existsSync(srcDir)) {
    console.error(`❌ 소스 폴더 없음: ${srcDir}\n   M1: 공식 이미지를 {제품코드}.png 형태로 이 폴더에 넣어주세요.`);
    process.exit(1);
  }
  if (!DRY) mkdirSync(outDir, { recursive: true });

  const files = readdirSync(srcDir).filter((f) => {
    const dot = f.lastIndexOf('.');
    return dot > 0 && EXTS.has(f.slice(dot).toLowerCase());
  });
  if (files.length === 0) {
    console.log(`(소스 폴더에 이미지 없음: ${srcDir})`);
    return;
  }

  console.log(`소스 ${files.length}개 · 출력 ${outDir} · ${DRY ? 'DRY-RUN' : SKIP_DB ? '이미지만' : '이미지+DB'}\n`);

  const processed: string[] = [];
  for (const f of files) {
    const code = f.slice(0, f.lastIndexOf('.'));
    const input = join(srcDir, f);
    const output = join(outDir, `${code}.jpg`);
    if (DRY) {
      console.log(`  [dry] ${f} → public/products/${code}.jpg`);
      processed.push(code);
      continue;
    }
    try {
      squareThumbnail(input, output);
      processed.push(code);
      console.log(`  ✓ ${f} → ${code}.jpg`);
    } catch (e) {
      console.warn(`  ✗ ${f} 변환 실패: ${(e as Error).message}`);
    }
  }

  console.log(`\n규격화 완료: ${processed.length}개`);

  if (SKIP_DB || DRY) {
    if (DRY) console.log('(dry-run — DB 미적용)');
    return;
  }

  // DB 적용 — 존재하는 product_code 만
  let updated = 0;
  let missing = 0;
  for (const code of processed) {
    const res = await db
      .update(lenses)
      .set({ imageUrl: `/products/${code}.jpg`, updatedAt: new Date() })
      .where(eq(lenses.productCode, code))
      .returning({ id: lenses.id });
    if (res.length > 0) updated += 1;
    else missing += 1;
  }
  console.log(`DB image_url 적용: ${updated}개 (제품 없음: ${missing}개)`);
}

main().then(() => process.exit(0));
