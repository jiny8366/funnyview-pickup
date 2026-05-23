/**
 * Mac 에서 실행 — 브랜드/리테일러 사이트에서 제품 이미지 자동 다운로드.
 *
 * Playwright (headless Chromium) 사용 — JS 렌더링 / Cloudflare 우회 가능.
 *
 * 사전 설치 (최초 1회):
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * 실행:
 *   npx tsx scripts/scrape-product-images.ts
 *
 * 동작:
 *   1. 한국 컬러렌즈 리테일러 (klenspop, lensme) + 브랜드 공식 사이트 순회
 *   2. 제품 페이지에서 메인 이미지 다운로드
 *   3. DB 의 productCode/colorName 와 fuzzy match 하여 public/products/{productCode}.jpg 로 저장
 *   4. 매칭 못 한 이미지는 public/products/_review/ 로 분리
 *   5. 완료 후 build-product-images-migration.ts 를 자동 실행
 *
 * 동작 후:
 *   git add public/products/ drizzle/
 *   git commit -m "feat: 제품 이미지 추가"
 *   git push origin main
 *
 * Vercel 자동 빌드 → image_url 일괄 적용.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const PRODUCTS_DIR = path.join(process.cwd(), 'public/products');
const REVIEW_DIR = path.join(PRODUCTS_DIR, '_review');
const CATALOG_URL = process.env.CATALOG_URL ?? 'https://funnyview-pickup.vercel.app/api/catalog';

interface CatalogLens {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  imageUrl: string | null;
}

interface ScrapedImage {
  source: string;
  sourceUrl: string;
  imageBuffer: Buffer;
  imageExt: 'jpg' | 'png' | 'webp';
  productTitle: string;
  brandHint: string;
}

const SOURCES: { brand: string; collectionUrls: string[]; productSelector: string; imageSelector: string }[] = [
  {
    brand: 'klenspop',
    collectionUrls: [
      'https://klenspop.com/collections/bausch-lomb-lacelle',
      'https://klenspop.com/collections/acuvue-define',
      'https://klenspop.com/collections/clalen-iris',
      'https://klenspop.com/collections/o2o2-by-clalen',
      'https://klenspop.com/collections/freshlook',
    ],
    productSelector: 'a[href*="/products/"]',
    imageSelector: 'img[src*="cdn.shopify.com"]',
  },
];

// Korean → English token mapping for fuzzy matching
const COLOR_TOKENS: Record<string, string[]> = {
  '브라운': ['brown'],
  '블랙': ['black'],
  '그레이': ['gray', 'grey'],
  '블루': ['blue'],
  '헤이즐': ['hazel'],
  '골드': ['gold'],
  '핑크': ['pink'],
  '오로라': ['aurora'],
  '시크': ['sheek', 'chic'],
  '글리터': ['glitter'],
  '루미너스': ['luminous'],
  '스팟라이트': ['spotlight'],
  '뮤즈': ['muse'],
  '미스틱': ['mystic'],
  '메리': ['merry'],
  '멜로우': ['mellow'],
  '쉬머링': ['shimmering'],
  '트윙클': ['twinkle'],
  '퓨어': ['pure'],
  '시크 브라운': ['sheek-brown', 'chic-brown', 'sheek brown'],
  '베이비': ['baby'],
  '디어': ['deer'],
  '밤비': ['bambi'],
  '쥬얼': ['jewel'],
  '얼루어': ['allure'],
  '사틴': ['satin'],
  '에스텔': ['estelle'],
  '알리샤': ['alicia'],
  '수지': ['suzy'],
  '소울': ['soul'],
  '랩소디': ['rhapsody'],
  '라틴': ['latin'],
  '째즈': ['jazz'],
  '헤일로': ['halo'],
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}

function koreanTokens(s: string): string[] {
  const out = new Set<string>();
  for (const [kr, en] of Object.entries(COLOR_TOKENS)) {
    if (s.includes(kr)) for (const e of en) out.add(e.toLowerCase());
  }
  return [...out];
}

function fuzzyMatchScore(scrapedTitle: string, lens: CatalogLens): number {
  const t = scrapedTitle.toLowerCase();
  const lensName = (lens.name + ' ' + (lens.colorName ?? '')).toLowerCase();
  const krTokens = koreanTokens(lensName);
  let score = 0;
  for (const tok of krTokens) {
    if (t.includes(tok)) score += 5;
  }
  // Brand match
  const brandEn: Record<string, string[]> = {
    '아큐브': ['acuvue'],
    '바슈롬': ['bausch', 'lomb', 'lacelle'],
    '알콘': ['alcon', 'freshlook'],
    '클라렌': ['clalen', 'iris'],
    '미광': ['ezene'],
  };
  for (const [kr, en] of Object.entries(brandEn)) {
    if (lens.brand.includes(kr)) for (const e of en) if (t.includes(e)) score += 3;
  }
  return score;
}

async function loadCatalog(): Promise<CatalogLens[]> {
  console.log(`📥 카탈로그 로드: ${CATALOG_URL}`);
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const json = await res.json() as { lenses: CatalogLens[] };
  console.log(`   → ${json.lenses.length} 제품`);
  return json.lenses;
}

async function scrapeKlenspop(): Promise<ScrapedImage[]> {
  // Playwright dynamic import — 미설치 시 친절한 안내
  // @ts-expect-error — playwright 는 devDependency, 미설치 시 catch
  const mod = await import('playwright').catch(() => null);
  if (!mod) {
    console.error('❌ playwright 가 설치되지 않았습니다.');
    console.error('   먼저 실행: npm install -D playwright && npx playwright install chromium');
    process.exit(1);
  }
  const chromium = mod.chromium;

  const results: ScrapedImage[] = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
  });

  for (const source of SOURCES) {
    for (const collUrl of source.collectionUrls) {
      console.log(`\n🔎 ${collUrl}`);
      const page = await context.newPage();
      try {
        await page.goto(collUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000); // JS render

        // Extract product cards
        const items = await page.evaluate(() => {
          const cards = document.querySelectorAll('a[href*="/products/"]');
          const seen = new Set<string>();
          const out: { url: string; title: string; img: string }[] = [];
          for (const card of cards) {
            const href = (card as HTMLAnchorElement).href;
            if (seen.has(href)) continue;
            const img = card.querySelector('img');
            if (!img) continue;
            const title = (card.textContent ?? '').trim().slice(0, 100);
            const imgSrc = (img as HTMLImageElement).src;
            if (!imgSrc) continue;
            seen.add(href);
            out.push({ url: href, title, img: imgSrc });
          }
          return out;
        });

        console.log(`   → ${items.length} 제품 카드 발견`);

        for (const item of items) {
          try {
            const cleanImg = item.img.replace(/_\d+x(\.|@)/, '$1').replace(/\?.*$/, ''); // Strip resize params
            const r = await fetch(cleanImg);
            if (!r.ok) continue;
            const buf = Buffer.from(await r.arrayBuffer());
            const ct = r.headers.get('content-type') ?? '';
            const ext: 'jpg' | 'png' | 'webp' = ct.includes('webp') ? 'webp' : ct.includes('png') ? 'png' : 'jpg';
            results.push({
              source: 'klenspop',
              sourceUrl: item.url,
              imageBuffer: buf,
              imageExt: ext,
              productTitle: item.title,
              brandHint: source.brand,
            });
          } catch (e) {
            console.warn(`   ⚠️  이미지 다운로드 실패: ${item.title}`);
          }
        }
      } catch (e) {
        console.error(`   ❌ ${collUrl} : ${(e as Error).message}`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  return results;
}

function matchToCatalog(scraped: ScrapedImage[], catalog: CatalogLens[]) {
  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_DIR, { recursive: true });

  const used = new Set<string>(); // productCode already matched
  let matched = 0;
  let review = 0;

  for (const img of scraped) {
    // 점수 매기기
    const scores = catalog
      .filter((l) => !used.has(l.productCode))
      .map((l) => ({ lens: l, score: fuzzyMatchScore(img.productTitle, l) }))
      .sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (best && best.score >= 8) {
      const filepath = path.join(PRODUCTS_DIR, `${best.lens.productCode}.${img.imageExt}`);
      fs.writeFileSync(filepath, img.imageBuffer);
      used.add(best.lens.productCode);
      matched++;
      console.log(`✅ ${best.lens.productCode} ← ${img.productTitle.slice(0, 50)} (score=${best.score})`);
    } else {
      const safeName = slugify(img.productTitle).slice(0, 60);
      const filepath = path.join(REVIEW_DIR, `${img.source}_${safeName}.${img.imageExt}`);
      fs.writeFileSync(filepath, img.imageBuffer);
      review++;
    }
  }

  console.log(`\n📊 매칭 완료:`);
  console.log(`   ✅ 자동 매칭: ${matched} 개 → public/products/`);
  console.log(`   📁 수동 검토 필요: ${review} 개 → public/products/_review/`);
}

async function main() {
  console.log(`🚀 제품 이미지 스크래퍼 시작\n`);

  const catalog = await loadCatalog();
  const scraped = await scrapeKlenspop();
  console.log(`\n📦 총 ${scraped.length} 개 이미지 스크랩 완료`);

  matchToCatalog(scraped, catalog);

  console.log(`\n💡 다음 단계:`);
  console.log(`   1. public/products/_review/ 폴더의 이미지를 확인하고`);
  console.log(`      매칭되지 않은 것을 productCode 로 직접 이름 변경 후 public/products/ 로 이동`);
  console.log(`   2. 마이그레이션 생성:`);
  console.log(`      npx tsx scripts/build-product-images-migration.ts`);
  console.log(`   3. git add public/products/ drizzle/`);
  console.log(`      git commit -m "feat: 제품 이미지 추가"`);
  console.log(`      git push origin main`);

  // 자동 마이그레이션 생성 시도
  try {
    console.log(`\n🔧 마이그레이션 자동 생성 중...`);
    execSync('npx tsx scripts/build-product-images-migration.ts', { stdio: 'inherit' });
  } catch {
    console.log(`   (자동 생성 실패. 위의 명령을 수동으로 실행하세요.)`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
