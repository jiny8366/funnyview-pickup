/**
 * 지니어스 콘택트렌즈 바코드 정보 — 카탈로그 import 스크립트.
 *
 * 사용:
 *   source .env.local          (또는 vercel env pull 후)
 *   npx tsx scripts/import-jinys-catalog.ts                    # 전체 브랜드 import
 *   npx tsx scripts/import-jinys-catalog.ts acuvue             # 특정 브랜드만
 *   npx tsx scripts/import-jinys-catalog.ts acuvue --dry-run   # 실제 INSERT 없이 미리보기
 *
 * 입력: scripts/fixtures/jinys-catalog/{brand}.json
 *
 * 동작:
 *  1. brands 마스터 upsert
 *  2. product_codes (시리즈) upsert
 *  3. lenses 제품 upsert (productCode 기준)
 *  4. lens_variants 도수 bulk upsert (sku 기준)
 *  5. lens_barcodes 바코드 1:N insert (conflict 무시)
 *
 * Idempotent — 같은 명령 여러 번 실행해도 결과 동일.
 */
import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  brands,
  lensBarcodes,
  lensVariants,
  lenses,
  productCodes,
} from '../src/db/schema';
import { generateSku } from '../src/lib/utils/sku';

interface FixtureBrand {
  nameKo: string;
  nameEn: string;
  code: string;
}
interface FixtureSeries {
  code: string;
  suffix: string;
  nameKo: string;
  nameEn: string;
}
interface FixtureVariant {
  sphere: number;
  cylinder: number | null;
  axis: number | null;
  addPower: number | null;
  barcodes: string[];
  supplierUnitNos: string[];
}
interface FixtureLens {
  sourceProductName: string;
  productCode: string;
  displayName: string;
  seriesCode: string;
  series: FixtureSeries;
  brand: string;
  brandCode: string;
  lensType: 'spherical' | 'toric' | 'multifocal' | 'color' | 'circle';
  replacementCycle: '1day' | '2week' | '1month' | '3month' | '6month' | '1year';
  piecesPerBox: number;
  baseCurve: number | null;
  addCategory: 'low' | 'mid' | 'high' | null;
  addPowerValue: number | null;
  variants: FixtureVariant[];
}
interface Fixture {
  brand: FixtureBrand;
  sourceFolder: string;
  fileCount: number;
  totalVariants: number;
  totalBarcodes: number;
  lenses: FixtureLens[];
}

const FIXTURE_DIR = join(__dirname, 'fixtures/jinys-catalog');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const brandArg = args.find((a) => !a.startsWith('--'));

// 브랜드 별칭 — 동일 브랜드로 취급할 표기 통합 (재import 해도 병합 유지)
const BRAND_ALIAS: Record<string, string> = {
  '클라렌O2O2': '클라렌',
};
const normalizeBrand = (b: string) => BRAND_ALIAS[b] ?? b;

async function ensureBrand(b: FixtureBrand): Promise<string> {
  if (DRY_RUN) return '__dry-run__';
  const found = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.code, b.code))
    .limit(1);
  if (found[0]) return found[0].id;
  const [row] = await db
    .insert(brands)
    .values({ nameKo: b.nameKo, nameEn: b.nameEn, code: b.code })
    .returning({ id: brands.id });
  return row.id;
}

async function ensureProductCode(s: FixtureSeries): Promise<string> {
  if (DRY_RUN) return '__dry-run__';
  const found = await db
    .select({ id: productCodes.id })
    .from(productCodes)
    .where(and(eq(productCodes.code, s.code), eq(productCodes.suffix, s.suffix)))
    .limit(1);
  if (found[0]) return found[0].id;
  const [row] = await db
    .insert(productCodes)
    .values({
      code: s.code,
      suffix: s.suffix,
      nameKo: s.nameKo,
      nameEn: s.nameEn,
    })
    .returning({ id: productCodes.id });
  return row.id;
}

async function upsertLens(l: FixtureLens): Promise<string> {
  if (DRY_RUN) return '__dry-run__';

  const existing = await db
    .select({ id: lenses.id })
    .from(lenses)
    .where(eq(lenses.productCode, l.productCode))
    .limit(1);

  const values = {
    productCode: l.productCode,
    brand: normalizeBrand(l.brand),
    name: l.displayName,
    lensType: l.lensType,
    replacementCycle: l.replacementCycle,
    piecesPerBox: l.piecesPerBox,
    baseCurve: l.baseCurve != null ? String(l.baseCurve) : null,
    seriesCode: l.seriesCode,
    price: 0, // placeholder — admin 이 추후 설정
    isActive: true,
  } satisfies Partial<typeof lenses.$inferInsert>;

  if (existing[0]) {
    await db
      .update(lenses)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(lenses.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(lenses).values(values).returning({ id: lenses.id });
  return row.id;
}

async function importLensVariants(
  lensId: string,
  l: FixtureLens,
): Promise<{ varCount: number; barCount: number; barSkipped: number }> {
  // 1. 도수 SKU 생성 + 바코드 매핑
  const variantRows: (typeof lensVariants.$inferInsert)[] = [];
  const variantBarcodes: { sku: string; barcodes: string[] }[] = [];

  for (const v of l.variants) {
    const sku = generateSku(l.productCode, {
      sphere: v.sphere,
      cylinder: v.cylinder,
      axis: v.axis,
      addPower: v.addPower,
    });

    variantRows.push({
      lensId,
      sku,
      sphere: String(v.sphere),
      cylinder: v.cylinder != null ? String(v.cylinder) : null,
      axis: v.axis,
      addPower: v.addPower != null ? String(v.addPower) : null,
      udiDi: v.barcodes[0] || null,
      isActive: true,
    });

    variantBarcodes.push({ sku, barcodes: v.barcodes });
  }

  if (DRY_RUN) {
    const totalBars = variantBarcodes.reduce((s, x) => s + x.barcodes.length, 0);
    return { varCount: variantRows.length, barCount: totalBars, barSkipped: 0 };
  }

  // 2. 도수 bulk upsert (sku 기준) — INSERT ... ON CONFLICT (sku) DO UPDATE SET col = EXCLUDED.col
  //    배치: PostgreSQL 65535 파라미터 제한, 행당 ~7 컬럼 → 한 번에 ~9000 행. 안전하게 1000.
  const VARIANT_BATCH = 1000;
  const skuToId = new Map<string, string>();
  for (let i = 0; i < variantRows.length; i += VARIANT_BATCH) {
    const slice = variantRows.slice(i, i + VARIANT_BATCH);
    const ret = await db
      .insert(lensVariants)
      .values(slice)
      .onConflictDoUpdate({
        target: lensVariants.sku,
        set: {
          sphere: sql`EXCLUDED.sphere`,
          cylinder: sql`EXCLUDED.cylinder`,
          axis: sql`EXCLUDED.axis`,
          addPower: sql`EXCLUDED.add_power`,
          udiDi: sql`EXCLUDED.udi_di`,
          isActive: sql`EXCLUDED.is_active`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: lensVariants.id, sku: lensVariants.sku });
    for (const r of ret) skuToId.set(r.sku, r.id);
  }

  // 3. 바코드 1:N bulk insert (conflict 무시)
  const barcodeRows: (typeof lensBarcodes.$inferInsert)[] = [];
  for (const { sku, barcodes } of variantBarcodes) {
    const variantId = skuToId.get(sku);
    if (!variantId) continue;
    for (let i = 0; i < barcodes.length; i++) {
      barcodeRows.push({
        variantId,
        barcode: barcodes[i],
        barcodeType: 'EAN13',
        isPrimary: i === 0,
      });
    }
  }

  let barCount = 0;
  let barSkipped = 0;
  const BARCODE_BATCH = 1000;
  for (let i = 0; i < barcodeRows.length; i += BARCODE_BATCH) {
    const slice = barcodeRows.slice(i, i + BARCODE_BATCH);
    const ret = await db
      .insert(lensBarcodes)
      .values(slice)
      .onConflictDoNothing({ target: lensBarcodes.barcode })
      .returning({ id: lensBarcodes.id });
    barCount += ret.length;
    barSkipped += slice.length - ret.length;
  }

  return { varCount: variantRows.length, barCount, barSkipped };
}

async function importBrandFixture(fixturePath: string) {
  const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

  console.log(`\n┌─ ${fixture.brand.nameKo} (${fixture.brand.code}) ─────────────────`);
  console.log(`│  📂 ${fixture.sourceFolder}`);
  console.log(`│  📦 제품 ${fixture.fileCount}개 / 도수 ${fixture.totalVariants}개 / 바코드 ${fixture.totalBarcodes}개`);
  if (DRY_RUN) console.log(`│  ⚠️  DRY-RUN (실제 INSERT 없음)`);
  console.log(`└────────────────────────────────────────────`);

  // 1. 브랜드
  console.log(`\n[1/3] 브랜드 upsert...`);
  const brandId = await ensureBrand(fixture.brand);
  console.log(`      ✓ brand_id = ${brandId.slice(0, 8)}...`);

  // 2. product_codes (시리즈)
  console.log(`\n[2/3] 시리즈 (product_codes) upsert...`);
  const uniqueSeries = new Map<string, FixtureSeries>();
  for (const l of fixture.lenses) {
    const k = `${l.series.code}_${l.series.suffix}`;
    if (!uniqueSeries.has(k)) uniqueSeries.set(k, l.series);
  }
  for (const s of uniqueSeries.values()) {
    await ensureProductCode(s);
    console.log(`      ✓ ${s.code}+${s.suffix} = ${s.nameKo}`);
  }

  // 3. lenses + variants + barcodes
  console.log(`\n[3/3] 제품 + 도수 + 바코드 import...`);
  let totalLens = 0,
    totalVar = 0,
    totalBar = 0,
    totalBarSkipped = 0;
  for (const l of fixture.lenses) {
    const lensId = await upsertLens(l);
    const { varCount, barCount, barSkipped } = await importLensVariants(lensId, l);
    totalLens++;
    totalVar += varCount;
    totalBar += barCount;
    totalBarSkipped += barSkipped;
    console.log(
      `      ✓ ${l.productCode.padEnd(25)} | ${varCount.toString().padStart(4)} var | ${barCount.toString().padStart(4)} new bar | ${l.displayName}`,
    );
  }

  console.log(`\n=== ${fixture.brand.nameKo} 완료 ===`);
  console.log(`제품: ${totalLens}개`);
  console.log(`도수: ${totalVar}개 (upsert)`);
  console.log(`바코드: ${totalBar}개 신규 / ${totalBarSkipped}개 기존 (중복 스킵)`);
}

async function main() {
  if (!process.env.DATABASE_URL && !DRY_RUN) {
    console.error('❌ DATABASE_URL 환경변수 필수. .env.local 확인 또는 --dry-run 사용.');
    process.exit(1);
  }

  if (!existsSync(FIXTURE_DIR)) {
    console.error(`❌ Fixture 디렉토리 없음: ${FIXTURE_DIR}`);
    process.exit(1);
  }

  // 어떤 fixture 처리할지 결정
  let targets: string[];
  if (brandArg) {
    const fp = join(FIXTURE_DIR, `${brandArg}.json`);
    if (!existsSync(fp)) {
      console.error(`❌ Fixture 없음: ${fp}`);
      process.exit(1);
    }
    targets = [fp];
  } else {
    targets = readdirSync(FIXTURE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(FIXTURE_DIR, f));
  }

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  지니어스 콘택트렌즈 바코드 정보 import          ║`);
  console.log(`║  대상: ${targets.length}개 fixture${DRY_RUN ? ' (DRY-RUN)' : ''}                          ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);

  for (const fp of targets) {
    await importBrandFixture(fp);
  }

  console.log(`\n🎉 전체 완료\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR:', e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
