import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * 브랜드 공식사이트 (acuvue.co.kr, clalen.com) 에서 제품 이미지 자동 추출.
 *
 * GET  /api/admin/scrape-brands           — dry run, 추출만, DB 수정 안 함
 * GET  /api/admin/scrape-brands?apply=1   — 매칭된 항목에 대해 image_url 업데이트
 * GET  /api/admin/scrape-brands?dump=1    — HTML 일부 + 추출된 img 태그 raw 반환 (디버깅용)
 *
 * 마스터/관리자 only.
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

interface ParsedImage {
  src: string;
  alt: string;
  surroundingText: string;
}

function absolutize(src: string, base: string): string {
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) {
    const u = new URL(base);
    return `${u.origin}${src}`;
  }
  return new URL(src, base).toString();
}

/** HTML 에서 img 태그 추출 (alt + 주변 텍스트 포함) */
function extractImages(html: string, base: string): ParsedImage[] {
  const out: ParsedImage[] = [];
  // <img ... src="..." alt="..." ...>
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(tag) || /\bdata-src=["']([^"']+)["']/i.exec(tag) || /\bdata-original=["']([^"']+)["']/i.exec(tag);
    if (!srcMatch) continue;
    const src = absolutize(srcMatch[1], base);
    if (!/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(src)) continue;
    if (/icon|logo|sprite|favicon|pixel|tracking/i.test(src)) continue;
    const altMatch = /\balt=["']([^"']*)["']/i.exec(tag);
    const alt = altMatch ? altMatch[1] : '';
    // 주변 500자 텍스트 추출 (alt 가 없을 때 매칭용)
    const start = Math.max(0, m.index - 300);
    const end = Math.min(html.length, m.index + tag.length + 300);
    const ctxRaw = html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.push({ src, alt, surroundingText: ctxRaw });
  }
  return out;
}

// 한글 → 영문 색명 후보 매핑 (제품명에 들어가는 키워드)
const KEYWORDS: Record<string, string[]> = {
  // Acuvue Define
  '엑센트': ['accent', 'eccentric'],
  '브라이트': ['bright'],
  '챠밍': ['charming'],
  '샤인': ['shine'],
  '시크': ['sheek', 'chic'],
  '스윗': ['sweet'],
  '비비드': ['vivid'],
  // Clalen Iris/Astra/O2O2 일부
  '알리샤': ['alicia'],
  '블루 문': ['blue moon', 'bluemoon'],
  '째즈': ['jazz'],
  '라틴': ['latin'],
  '랩소디': ['rhapsody'],
  '소울': ['soul'],
  '수지': ['suzy'],
  '에스텔': ['estelle'],
  '글리터': ['glitter'],
  '헤일로': ['halo'],
  '애쉬': ['ash'],
  '블랜딩': ['blending'],
  '세피아': ['sepia'],
};

interface CatalogRow {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  colorName: string | null;
  imageUrl: string | null;
  seriesCode: string | null;
}

function matchScore(img: ParsedImage, lens: CatalogRow): number {
  const haystack = (img.alt + ' ' + img.surroundingText + ' ' + img.src).toLowerCase();
  const colorName = (lens.colorName ?? '').toLowerCase();
  const productName = lens.name.toLowerCase();
  let s = 0;

  // 한글 컬러명 직접 매칭
  if (colorName && haystack.includes(colorName)) s += 10;

  // 한글 토큰들 (예: '엑센트' → 'accent')
  for (const [kr, en] of Object.entries(KEYWORDS)) {
    if (productName.includes(kr.toLowerCase()) || colorName.includes(kr.toLowerCase())) {
      if (haystack.includes(kr.toLowerCase())) s += 6;
      for (const e of en) if (haystack.includes(e.toLowerCase())) s += 5;
    }
  }

  // 시리즈 코드 (예: 'define', 'iris')
  if (lens.brand.includes('아큐브') && /define/i.test(haystack)) s += 3;
  if (lens.brand.includes('클라렌') && /(iris|클라렌|clalen|astra|아스트라)/i.test(haystack)) s += 3;
  if (lens.brand.includes('클라렌') && lens.name.includes('O2O2') && /(o2o2|오투오투)/i.test(haystack)) s += 3;

  return s;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return { html: await r.text(), finalUrl: r.url };
}

const SOURCES: { url: string; brand: string }[] = [
  // Acuvue Define — 메인 + 1Day 분리 페이지 모두 시도
  { url: 'https://www.acuvue.co.kr/products/define-family', brand: '아큐브' },
  { url: 'https://www.acuvue.co.kr/products/acuvue-define-1-day', brand: '아큐브' },
  // Clalen — 메인 + 제품 카테고리들
  { url: 'https://www.clalen.com/', brand: '클라렌' },
  { url: 'https://www.clalen.com/products', brand: '클라렌' },
];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && !user.isMaster)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const apply = url.searchParams.get('apply') === '1';
  const dump = url.searchParams.get('dump') === '1';

  const catalog: CatalogRow[] = await db
    .select({
      id: lenses.id,
      productCode: lenses.productCode,
      brand: lenses.brand,
      name: lenses.name,
      colorName: lenses.colorName,
      imageUrl: lenses.imageUrl,
      seriesCode: lenses.seriesCode,
    })
    .from(lenses)
    .where(and(eq(lenses.isActive, true), isNull(lenses.deletedAt)));

  const fetches = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const { html, finalUrl } = await fetchHtml(s.url);
        const imgs = extractImages(html, finalUrl);
        return { source: s, finalUrl, htmlBytes: html.length, images: imgs };
      } catch (e) {
        return { source: s, finalUrl: s.url, htmlBytes: 0, images: [] as ParsedImage[], error: (e as Error).message };
      }
    }),
  );

  if (dump) {
    return NextResponse.json({
      fetches: fetches.map((f) => ({
        url: f.source.url,
        finalUrl: f.finalUrl,
        htmlBytes: f.htmlBytes,
        imageCount: f.images.length,
        sampleImages: f.images.slice(0, 30).map((i) => ({ src: i.src, alt: i.alt, ctx: i.surroundingText.slice(0, 200) })),
      })),
    });
  }

  // 매칭
  const allImages = fetches.flatMap((f) => f.images);
  const matched: { productCode: string; lens: string; imageUrl: string; score: number }[] = [];
  const usedSrc = new Set<string>();
  const usedCode = new Set<string>();

  // For each lens, find best image
  for (const lens of catalog) {
    if (lens.imageUrl) continue; // 이미 image 있으면 skip
    if (usedCode.has(lens.productCode)) continue;
    const scored = allImages
      .filter((img) => !usedSrc.has(img.src))
      .map((img) => ({ img, score: matchScore(img, lens) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score >= 8) {
      matched.push({
        productCode: lens.productCode,
        lens: `${lens.brand} ${lens.name}${lens.colorName ? ` (${lens.colorName})` : ''}`,
        imageUrl: best.img.src,
        score: best.score,
      });
      usedSrc.add(best.img.src);
      usedCode.add(lens.productCode);
    }
  }

  let updated = 0;
  const errors: string[] = [];
  if (apply && matched.length > 0) {
    for (const m of matched) {
      try {
        await db
          .update(lenses)
          .set({ imageUrl: m.imageUrl, updatedAt: new Date() })
          .where(eq(lenses.productCode, m.productCode));
        updated++;
      } catch (e) {
        errors.push(`${m.productCode}: ${(e as Error).message}`);
      }
    }
  }

  return NextResponse.json({
    summary: {
      sourcesOk: fetches.filter((f) => !('error' in f)).length,
      sourcesFailed: fetches.filter((f) => 'error' in f).length,
      totalImages: allImages.length,
      catalogSize: catalog.length,
      catalogWithoutImage: catalog.filter((l) => !l.imageUrl).length,
      matched: matched.length,
      applied: updated,
      apply,
    },
    matched: matched.slice(0, 100),
    errors,
  });
}
