import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { lenses } from '@/db/schema';

/**
 * 동적 SVG 제품 이미지 생성기.
 *
 * 브랜드 제품 사진을 참고한 사실적인 홍채 표현 — 컬러렌즈는 다층 그라디언트
 * + 방사형 섬유 패턴 + 림 + 하이라이트로 e-commerce 제품샷 느낌.
 *
 * 캐시: 24시간 (CDN + brower)
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

/** hex (#RRGGBB) → {h, s, l} */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lit = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue *= 60;
  }
  return { h: hue, s: sat * 100, l: lit * 100 };
}

function hsl(h: number, s: number, l: number, a = 1) {
  return a < 1 ? `hsla(${h},${s}%,${l}%,${a})` : `hsl(${h},${s}%,${l}%)`;
}

/** 홍채 방사형 섬유 패턴 — 64개의 미세한 선 */
function irisFibers(cx: number, cy: number, rOuter: number, rInner: number, baseHsl: ReturnType<typeof hexToHsl>) {
  const lines: string[] = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    // 섬유 굵기/색상 랜덤 (deterministic — angle 기반 시드)
    const seed = Math.sin(i * 1337.7) * 10000;
    const wave = seed - Math.floor(seed); // 0..1
    const innerR = rInner + 3 + wave * 6;
    const outerR = rOuter - 4 - wave * 5;
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;
    // 명암: 어두운 섬유 (depth) + 밝은 섬유 (highlight) 혼합
    const isDark = wave < 0.55;
    const lOffset = isDark ? -15 - wave * 12 : 15 + wave * 12;
    const sat = Math.max(0, Math.min(100, baseHsl.s + (isDark ? -10 : 10)));
    const lit = Math.max(8, Math.min(92, baseHsl.l + lOffset));
    const opacity = isDark ? 0.5 + wave * 0.35 : 0.25 + wave * 0.3;
    const width = 0.5 + wave * 0.9;
    lines.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${hsl(baseHsl.h, sat, lit)}" stroke-width="${width.toFixed(2)}" stroke-opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`,
    );
  }
  return lines.join('');
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
  const hex = lens.colorHex ?? '#7a6a5a';
  const baseHsl = hexToHsl(hex);

  // 배경 — 컬러렌즈는 어두운 스튜디오 톤, 일반렌즈는 깔끔한 라이트 톤
  const bg = colored
    ? { from: '#1d1d20', to: '#0a0a0c' }
    : { from: '#f9fafb', to: '#dde2e8' };
  const textPrimary = colored ? '#ffffff' : '#0f172a';
  const textSub = colored ? 'rgba(255,255,255,0.6)' : '#64748b';
  const textBrand = colored ? 'rgba(255,255,255,0.4)' : '#475569';

  const cx = 200;
  const cy = 230;
  const rOuter = 130;  // 홍채 외곽 (더 크게)
  const rPupil = 32;   // 동공
  const rRing = rOuter + 4; // 림 다크 링

  let lensRender: string;
  if (colored) {
    // 컬러렌즈 — 사실적 홍채 + 림 + 섬유 + 하이라이트
    const fibers = irisFibers(cx, cy, rOuter, rPupil, baseHsl);
    lensRender = `
    <!-- 외곽 어두운 그림자 (림) -->
    <circle cx="${cx}" cy="${cy}" r="${rRing}" fill="url(#rim)" />

    <!-- 홍채 베이스 -->
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="url(#iris)" />

    <!-- 섬유 패턴 (방사형) -->
    <g style="mix-blend-mode: overlay">${fibers}</g>

    <!-- 안쪽 동공 주변 어두운 링 -->
    <circle cx="${cx}" cy="${cy}" r="${rPupil + 8}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="6" />

    <!-- 외곽 다크 림 -->
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="3" />
    <circle cx="${cx}" cy="${cy}" r="${rOuter - 2}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="1" />

    <!-- 동공 -->
    <circle cx="${cx}" cy="${cy}" r="${rPupil}" fill="#070608" />
    <circle cx="${cx}" cy="${cy}" r="${rPupil}" fill="url(#pupilShine)" />

    <!-- 큰 하이라이트 (조명 반사) -->
    <ellipse cx="${cx - 38}" cy="${cy - 42}" rx="32" ry="22" fill="url(#highlight1)" opacity="0.85" />

    <!-- 작은 점광 -->
    <circle cx="${cx - 48}" cy="${cy - 50}" r="10" fill="rgba(255,255,255,0.95)" />
    <circle cx="${cx - 30}" cy="${cy - 30}" r="4" fill="rgba(255,255,255,0.85)" />

    <!-- 하단 반사 -->
    <ellipse cx="${cx + 30}" cy="${cy + 60}" rx="40" ry="10" fill="rgba(255,255,255,0.08)" />`;
  } else {
    // 일반 투명렌즈 — 글래시 렌즈 형태
    lensRender = `
    <!-- 렌즈 그림자 (지면) -->
    <ellipse cx="${cx}" cy="${cy + rOuter - 5}" rx="${rOuter - 10}" ry="10" fill="rgba(0,0,0,0.08)" />

    <!-- 렌즈 외곽 -->
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="url(#clearLens)" />
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="#cbd5e1" stroke-width="2.5" />

    <!-- 내부 윤곽 (광학 영역) -->
    <circle cx="${cx}" cy="${cy}" r="${rOuter - 15}" fill="none" stroke="rgba(148,163,184,0.5)" stroke-width="0.8" />
    <circle cx="${cx}" cy="${cy}" r="${rOuter - 30}" fill="none" stroke="rgba(148,163,184,0.3)" stroke-width="0.5" />

    <!-- 중앙 점 -->
    <circle cx="${cx}" cy="${cy}" r="3" fill="#94a3b8" />

    <!-- 큰 하이라이트 -->
    <ellipse cx="${cx - 35}" cy="${cy - 40}" rx="40" ry="22" fill="rgba(255,255,255,0.85)" />
    <ellipse cx="${cx + 30}" cy="${cy + 50}" rx="22" ry="8" fill="rgba(255,255,255,0.45)" />`;
  }

  // NEW 배지
  const newBadge = lens.isNew
    ? `<g transform="translate(330, 28)">
        <rect width="48" height="22" rx="11" fill="#ec4899"/>
        <text x="24" y="15" fill="white" font-family="system-ui, sans-serif" font-size="10" font-weight="800" text-anchor="middle" letter-spacing="1.5">NEW</text>
      </g>`
    : '';

  // 컬러 점 (콜아웃)
  const colorDot = colored && lens.colorHex
    ? `<g transform="translate(345, 230)">
        <circle r="22" fill="white" opacity="0.95"/>
        <circle r="18" fill="url(#dotGrad)"/>
       </g>`
    : '';

  // 하단 텍스트 — 길이 제한
  const productName =
    lens.name.length > 26 ? lens.name.slice(0, 24) + '…' : lens.name;
  const subLabel =
    lens.colorName ?? CYCLE_LABEL[lens.replacementCycle] ?? lens.replacementCycle;

  // 색상 변형 (밝은/어두운/saturated 스톱들)
  const stop0 = hsl(baseHsl.h, Math.max(0, baseHsl.s - 10), Math.min(96, baseHsl.l + 28));
  const stop1 = hsl(baseHsl.h, baseHsl.s, Math.min(85, baseHsl.l + 12));
  const stop2 = hex;
  const stop3 = hsl(baseHsl.h, Math.min(100, baseHsl.s + 10), Math.max(8, baseHsl.l - 18));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 533" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg.from}"/>
      <stop offset="1" stop-color="${bg.to}"/>
    </linearGradient>
    ${
      colored
        ? `<radialGradient id="iris" cx="40%" cy="38%" r="62%">
        <stop offset="0" stop-color="${stop0}"/>
        <stop offset="0.25" stop-color="${stop1}"/>
        <stop offset="0.62" stop-color="${stop2}"/>
        <stop offset="0.92" stop-color="${stop3}"/>
        <stop offset="1" stop-color="${hsl(baseHsl.h, baseHsl.s, Math.max(4, baseHsl.l - 28))}"/>
      </radialGradient>
      <radialGradient id="rim" cx="50%" cy="50%" r="50%">
        <stop offset="0.92" stop-color="rgba(0,0,0,0)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.6)"/>
      </radialGradient>
      <radialGradient id="pupilShine" cx="35%" cy="30%" r="55%">
        <stop offset="0" stop-color="rgba(255,255,255,0.25)"/>
        <stop offset="0.5" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <radialGradient id="highlight1" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="rgba(255,255,255,0.9)"/>
        <stop offset="0.6" stop-color="rgba(255,255,255,0.2)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <radialGradient id="dotGrad" cx="35%" cy="35%" r="60%">
        <stop offset="0" stop-color="${stop1}"/>
        <stop offset="0.7" stop-color="${stop2}"/>
        <stop offset="1" stop-color="${stop3}"/>
      </radialGradient>`
        : `<radialGradient id="clearLens" cx="40%" cy="35%" r="70%">
        <stop offset="0" stop-color="rgba(255,255,255,0.95)"/>
        <stop offset="0.7" stop-color="rgba(241,245,249,0.6)"/>
        <stop offset="1" stop-color="rgba(203,213,225,0.3)"/>
      </radialGradient>`
    }
  </defs>

  <rect width="400" height="533" fill="url(#bg)"/>

  <!-- 상단 브랜드 -->
  <text x="30" y="50" fill="${textBrand}" font-family="'Pretendard', system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="2.5">${xml(lens.brand.toUpperCase())}</text>

  ${newBadge}

  <!-- 렌즈 -->
  ${lensRender}
  ${colorDot}

  <!-- 하단 텍스트 -->
  <text x="30" y="455" fill="${textPrimary}" font-family="'Pretendard', system-ui, sans-serif" font-size="22" font-weight="800">${xml(productName)}</text>
  <text x="30" y="482" fill="${textSub}" font-family="'Pretendard', system-ui, sans-serif" font-size="13" font-weight="500">${xml(subLabel)}</text>

  <!-- 우하단 작은 마크 -->
  <text x="370" y="482" fill="${textSub}" font-family="'Pretendard', system-ui, sans-serif" font-size="10" font-weight="500" text-anchor="end" letter-spacing="1.5">FUNNYVIEW</text>
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
