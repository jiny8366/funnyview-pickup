/**
 * Vercel 빌드 중 1회 실행 — 지니스안경 매장 자동 import.
 *
 * 이미 import 되었으면 (J001 존재) skip. 첫 배포 1회만 실제 fetch + insert.
 * 네트워크 실패해도 build 는 계속됨 (graceful).
 *
 * 환경:
 *   DATABASE_URL: drizzle 마이그레이션 직후이므로 항상 있음
 *   JINYS_IMPORT_SKIP=1 : 강제 skip (긴급 우회)
 *
 * 실행 위치: vercel:build = drizzle-kit migrate && tsx scripts/import-jinys-on-build.ts && next build
 */

import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import { stores } from '../src/db/schema';

const SOURCE_BASE = 'https://home.jinys.co.kr/store-list';
const MAX_PAGES = 12;
const TEST_STORE_CODES = ['ST-0001', 'ST-0002', 'ST-0003'];

const REGIONS = new Set([
  '강원', '경기', '경남', '경북', '광주', '대전',
  '부산', '서울', '울산', '인천', '전북', '전남',
  '세종', '충북', '충남', '제주', '대구',
]);

const PHONE_RE = /^\d{2,3}-\d{3,4}-\d{4}$/;

interface ParsedStore {
  region: string;
  name: string;
  address: string;
  phone: string;
}

function htmlToLines(html: string): string[] {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<[^>]+>/g, '\n');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

function parseStoresFromLines(lines: string[]): ParsedStore[] {
  const out: ParsedStore[] = [];
  for (let i = 0; i < lines.length - 3; i++) {
    const region = lines[i];
    if (!REGIONS.has(region)) continue;
    const name = lines[i + 1] ?? '';
    const address = lines[i + 2] ?? '';
    const phone = lines[i + 3] ?? '';
    if (!name.includes('점')) continue;
    if (!PHONE_RE.test(phone)) continue;
    if (
      !address.startsWith(region) &&
      !/(시|군|구|특별자치|광역시|특별시|도)/.test(address)
    )
      continue;
    out.push({ region, name, address, phone });
    i += 3;
  }
  return out;
}

function normalizeName(name: string): string {
  return name
    .replace(/^지니스안경\s*/, '')
    .replace(/^지니스\s*/, '')
    .trim();
}

async function main() {
  if (process.env.JINYS_IMPORT_SKIP === '1') {
    console.log('[jinys-build] JINYS_IMPORT_SKIP=1, 스킵');
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log('[jinys-build] DATABASE_URL 없음, 스킵 (로컬 typecheck 등)');
    return;
  }

  console.log('[jinys-build] 지니스 매장 자동 import 체크');

  // 1) 이미 import 되었는지 확인 (J001 존재 여부)
  try {
    const existing = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.code, 'J001'))
      .limit(1);
    if (existing.length > 0) {
      console.log('[jinys-build] J001 이미 존재 — 스킵');
      return;
    }
  } catch (e) {
    console.warn('[jinys-build] DB 조회 실패, 스킵:', (e as Error).message);
    return;
  }

  // 2) 페이지 스크랩
  const all: ParsedStore[] = [];
  let lastPageWithData = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const r = await fetch(`${SOURCE_BASE}?page=${page}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      });
      if (!r.ok) {
        console.warn(`[jinys-build] page${page}: HTTP ${r.status}`);
        continue;
      }
      const html = await r.text();
      const parsed = parseStoresFromLines(htmlToLines(html));
      if (parsed.length > 0) lastPageWithData = page;
      all.push(...parsed);
      if (page - lastPageWithData >= 2 && page > 3) break;
    } catch (e) {
      console.warn(`[jinys-build] page${page} fetch 실패:`, (e as Error).message);
    }
  }

  // 중복 제거
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const k = `${s.name}|${s.phone}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (unique.length === 0) {
    console.warn('[jinys-build] 파싱된 매장 0개 — 스킵 (네트워크/HTML 구조 변경 가능)');
    return;
  }

  console.log(`[jinys-build] ${unique.length} 매장 파싱 완료`);

  // 3) 테스트 매장 soft-delete
  const now = new Date();
  try {
    await db
      .update(stores)
      .set({ deletedAt: now, isActive: false, updatedAt: now })
      .where(inArray(stores.code, TEST_STORE_CODES));
    console.log('[jinys-build] 테스트 매장 soft-delete 완료:', TEST_STORE_CODES);
  } catch (e) {
    console.warn('[jinys-build] 테스트 매장 정리 실패:', (e as Error).message);
  }

  // 4) Jinys 매장 일괄 insert (배치 — N+1 회피)
  const values = unique.map((s, i) => ({
    code: `J${String(i + 1).padStart(3, '0')}`,
    name: normalizeName(s.name),
    phone: s.phone,
    addressLine1: s.address,
    commissionRate: '10.00',
    sortOrder: i,
  }));
  let inserted = 0;
  try {
    const result = await db.insert(stores).values(values).returning({ id: stores.id });
    inserted = result.length;
  } catch (e) {
    console.warn('[jinys-build] 일괄 insert 실패, 개별 fallback:', (e as Error).message);
    for (const v of values) {
      try {
        await db.insert(stores).values(v);
        inserted++;
      } catch (err) {
        console.warn(`[jinys-build] ${v.code} insert 실패:`, (err as Error).message);
      }
    }
  }

  console.log(`[jinys-build] 완료 — ${inserted} 매장 등록`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[jinys-build] 예외:', e);
    process.exit(0); // build 차단하지 않음
  });
