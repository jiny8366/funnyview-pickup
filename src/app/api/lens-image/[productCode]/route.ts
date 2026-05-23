import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';

/**
 * 동적 SVG 플레이스홀더 생성기.
 *
 * 실제 제품 사진이 준비되기 전까지 사용. imageUrl 이 NULL 일 때
 * ProductCard / CatalogCard 가 이 URL 로 fallback.
 *
 * 캐시: 24시간 (제품 메타데이터 변경 빈도 낮음).
 *
 * URL 예: /api/lens-image/ACU-DACCL-30P
 */

export const revalidate = 86400;

const CYCLE_LABEL: Record<string, string> = {
  '1day': 'ONE-DAY',
  '2week': '2 WEEK',
  '1month': '1 MONTH',
  '3month': '3 MONTH',
  '6month': '6 MONTH',
  '1year': '1 YEAR',
};

function xml(s: string) {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!),
  );
}

function fallbackSvg(message: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 533" fill="none">
  <rect width="400" height="533" fill="#f3f4f6"/>
  <text x="200" y="266" fill="#9ca3af" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">${xml(message)}</text>
</svg>`;
}

function generateSvg(lens: {
  brand: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  replacementCycle: string;
  lensType: string;
  isNew: boolean;
}) {
  const colored = lens.lensType === 'color' || lens.lensType === 'circle';
  const hex = lens.colorHex ?? '#9ca3af';

  // 배경
  const bg = colored
    ? { from: '#1a1a1c', to: '#08080a' }
    : { from: '#f8fafc', to: '#e2e8f0' };
  const textPrimary = colored ? '#ffffff' : '#0f172a';
  const textSub = colored ? 'rgba(255,255,255,0.55)' : '#94a3b8';
  const textBrand = colored ? 'rgba(255,255,255,0.4)' : '#64748b';

  // 렌즈 원 표현
  const cx = 200;
  const cy = 235;
  const r = 105;

  const lensCircle = colored
    ? `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#iris)" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
    <circle cx="${cx}" cy="${cy}" r="28" fill="rgba(0,0,0,0.55)" />
    <ellipse cx="${cx - 25}" cy="${cy - 28}" rx="22" ry="14" fill="rgba(255,255,255,0.18)" />
    <circle cx="${cx - 32}" cy="${cy - 32}" r="6" fill="rgba(255,255,255,0.65)" />`
    : `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#cbd5e1" stroke-width="2.5" />
    <circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="none" stroke="#e2e8f0" stroke-width="1" />
    <circle cx="${cx}" cy="${cy}" r="6" fill="#cbd5e1" />
    <ellipse cx="${cx - 28}" cy="${cy - 30}" rx="18" ry="10" fill="rgba(255,255,255,0.7)" />`;

  // NEW 배지
  const newBadge = lens.isNew
    ? `<g transform="translate(330, 30)">
        <rect width="44" height="20" rx="10" fill="#ec4899"/>
        <text x="22" y="14" fill="white" font-family="system-ui, sans-serif" font-size="10" font-weight="800" text-anchor="middle" letter-spacing="1">NEW</text>
      </g>`
    : '';

  // 컬러 점 (colorPreviewUrl 대신)
  const colorDot = colored && lens.colorHex
    ? `<g transform="translate(340, 235)">
        <circle r="20" fill="white"/>
        <circle r="17" fill="${lens.colorHex}"/>
       </g>`
    : '';

  // 하단 텍스트 — 제품명이 길면 잘림 (CSS truncate 안되니 길이 제한)
  const productName =
    lens.name.length > 26 ? lens.name.slice(0, 24) + '…' : lens.name;
  const subLabel =
    lens.colorName ?? CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 533" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg.from}"/>
      <stop offset="1" stop-color="${bg.to}"/>
    </linearGradient>
    ${
      colored
        ? `<radialGradient id="iris" cx="38%" cy="35%" r="65%">
        <stop offset="0" stop-color="${hex}30"/>
        <stop offset="0.45" stop-color="${hex}aa"/>
        <stop offset="1" stop-color="${hex}"/>
      </radialGradient>`
        : ''
    }
  </defs>

  <rect width="400" height="533" fill="url(#bg)"/>

  <!-- 상단 브랜드 -->
  <text x="30" y="50" fill="${textBrand}" font-family="'Pretendard', system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="2">${xml(lens.brand.toUpperCase())}</text>

  ${newBadge}

  <!-- 렌즈 -->
  ${lensCircle}
  ${colorDot}

  <!-- 하단 텍스트 -->
  <text x="30" y="460" fill="${textPrimary}" font-family="'Pretendard', system-ui, sans-serif" font-size="22" font-weight="800">${xml(productName)}</text>
  <text x="30" y="486" fill="${textSub}" font-family="'Pretendard', system-ui, sans-serif" font-size="13" font-weight="500">${xml(subLabel)}</text>

  <!-- 우하단 작은 마크 -->
  <text x="370" y="486" fill="${textSub}" font-family="'Pretendard', system-ui, sans-serif" font-size="10" font-weight="500" text-anchor="end" letter-spacing="1">FUNNYVIEW</text>
</svg>`;
}

export async function GET(
  _req: Request,
  { params }: { params: { productCode: string } },
) {
  try {
    const [row] = await db
      .select({
        brand: lenses.brand,
        name: lenses.name,
        colorName: lenses.colorName,
        colorHex: lenses.colorHex,
        replacementCycle: lenses.replacementCycle,
        lensType: lenses.lensType,
        isNew: lenses.isNew,
      })
      .from(lenses)
      .where(eq(lenses.productCode, params.productCode))
      .limit(1);

    const svg = row ? generateSvg(row) : fallbackSvg('제품을 찾을 수 없습니다');

    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response(fallbackSvg('이미지 생성 실패'), {
      headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
    });
  }
}
