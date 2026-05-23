import { NextResponse } from 'next/server';
import { eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * 지니스안경 home.jinys.co.kr/store-list 페이지를 Vercel 서버에서 scrape →
 * stores 테이블에 일괄 import. 마스터/관리자 only.
 *
 * GET  /api/admin/import-jinys-stores            dry-run (DB 변경 없음, 파싱 결과만)
 * POST /api/admin/import-jinys-stores            실제 import (테스트 가맹점 ST-0001/0002/0003 soft-delete + Jinys 매장 upsert)
 *
 * 파서: scripts/import-jinys-stores.ts 의 로직과 동일.
 * 페이지 수: 1~12 (대부분 10페이지 이내, 여유를 둠).
 */

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
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
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

async function fetchPages(): Promise<{ pages: number; parsed: ParsedStore[]; errors: string[] }> {
  const errors: string[] = [];
  const all: ParsedStore[] = [];
  let lastPageWithData = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const r = await fetch(`${SOURCE_BASE}?page=${page}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      });
      if (!r.ok) {
        errors.push(`page${page}: ${r.status}`);
        continue;
      }
      const html = await r.text();
      const lines = htmlToLines(html);
      const parsed = parseStoresFromLines(lines);
      if (parsed.length > 0) lastPageWithData = page;
      all.push(...parsed);
      // 빈 페이지가 2번 연속이면 종료
      if (page - lastPageWithData >= 2 && page > 3) break;
    } catch (e) {
      errors.push(`page${page}: ${(e as Error).message}`);
    }
  }

  // 중복 제거 (name + phone)
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const k = `${s.name}|${s.phone}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { pages: lastPageWithData, parsed: unique, errors };
}

async function authCheck() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && !user.isMaster)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const fail = await authCheck();
  if (fail) return fail;

  const { pages, parsed, errors } = await fetchPages();

  return NextResponse.json({
    dryRun: true,
    summary: { pages, parsed: parsed.length, errors: errors.length },
    errors,
    sample: parsed.slice(0, 10),
    all: parsed.map((s, i) => ({
      code: `J${String(i + 1).padStart(3, '0')}`,
      region: s.region,
      name: normalizeName(s.name),
      address: s.address,
      phone: s.phone,
    })),
  });
}

export async function POST() {
  const fail = await authCheck();
  if (fail) return fail;

  const { pages, parsed, errors: fetchErrors } = await fetchPages();

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: 'no stores parsed', pages, fetchErrors },
      { status: 400 },
    );
  }

  // 1) 테스트 가맹점 soft-delete
  const now = new Date();
  await db
    .update(stores)
    .set({ deletedAt: now, isActive: false, updatedAt: now })
    .where(inArray(stores.code, TEST_STORE_CODES));

  // 2) Jinys 매장 upsert
  let inserted = 0;
  let updated = 0;
  const writeErrors: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const s = parsed[i];
    const code = `J${String(i + 1).padStart(3, '0')}`;
    const normalized = normalizeName(s.name);

    try {
      const existing = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.code, code))
        .limit(1);

      if (existing[0]) {
        await db
          .update(stores)
          .set({
            name: normalized,
            phone: s.phone,
            addressLine1: s.address,
            deletedAt: null,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(stores.id, existing[0].id));
        updated++;
      } else {
        await db.insert(stores).values({
          code,
          name: normalized,
          phone: s.phone,
          addressLine1: s.address,
          commissionRate: '10.00',
          sortOrder: i,
        });
        inserted++;
      }
    } catch (e) {
      writeErrors.push(`${code} ${normalized}: ${(e as Error).message}`);
    }
  }

  // 3) 활성 카운트 확인
  const activeRows = await db
    .select({ id: stores.id })
    .from(stores)
    .where(isNull(stores.deletedAt));

  return NextResponse.json({
    summary: {
      pagesFetched: pages,
      parsed: parsed.length,
      inserted,
      updated,
      testDeleted: TEST_STORE_CODES,
      activeStoresAfter: activeRows.length,
    },
    fetchErrors,
    writeErrors,
  });
}
