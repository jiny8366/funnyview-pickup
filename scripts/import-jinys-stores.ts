/**
 * 지니스안경 매장 리스트 → stores 테이블 일괄 import.
 *
 * 사용:
 *   1) 본인 PC 에서 ~/jinys-pages/ 에 page1.html ~ pageN.html 다운로드
 *      mkdir -p ~/jinys-pages && for p in 1 2 3 4 5 6 7 8 9 10; do \
 *        curl -s -A 'Mozilla/5.0' "https://home.jinys.co.kr/store-list?page=$p" \
 *          -o ~/jinys-pages/page$p.html; \
 *      done
 *   2) cd ~/funnyview-pickup
 *      DATABASE_URL='...' npm run db:import-jinys
 *
 * 환경변수:
 *   JINYS_DIR — HTML 파일 폴더 (기본 ~/jinys-pages)
 *   DRY_RUN=1 — DB 쓰기 없이 파싱 결과만 출력
 *
 * 매장 카드 패턴 (region → name → address → phone 4 라인 순):
 *   세종
 *   세종새롬110호점
 *   세종특별자치시 새롬중앙로 33 새뜸프라자
 *   044-715-7229
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { stores } from '../src/db/schema';
import { geocodeAddress } from '../src/lib/geo/kakao';

const DIR = process.env.JINYS_DIR || path.join(os.homedir(), 'jinys-pages');
const DRY_RUN = process.env.DRY_RUN === '1';

// 한국 17개 시·도 (지니스 페이지의 지역 칩과 일치)
const REGIONS = new Set([
  '강원', '경기', '경남', '경북', '광주', '대전',
  '부산', '서울', '울산', '인천', '전북', '전남',
  '세종', '충북', '충남', '제주', '대구',
]);

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

const PHONE_RE = /^\d{2,3}-\d{3,4}-\d{4}$/;

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
    // 주소 검증: 지역명으로 시작하거나 시/도 패턴 포함
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
  // '지니스안경 XX점' → 'XX점'
  return name
    .replace(/^지니스안경\s*/, '')
    .replace(/^지니스\s*/, '')
    .trim();
}

async function main() {
  console.log(`[import-jinys] reading from ${DIR}`);
  if (!fs.existsSync(DIR)) {
    console.error(`디렉토리 없음: ${DIR}\n먼저 ~/jinys-pages 에 HTML 다운로드 후 실행하세요.`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DIR)
    .filter((f) => /^page\d+\.html$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)![0]);
      const nb = Number(b.match(/\d+/)![0]);
      return na - nb;
    });

  if (files.length === 0) {
    console.error(`HTML 파일 없음: ${DIR}/page*.html`);
    process.exit(1);
  }

  console.log(`[import-jinys] files: ${files.length}개`);

  const all: ParsedStore[] = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(DIR, f), 'utf-8');
    const lines = htmlToLines(html);
    const parsed = parseStoresFromLines(lines);
    console.log(`  ${f}: ${parsed.length} stores`);
    all.push(...parsed);
  }

  // 중복 제거 (name + phone)
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const k = `${s.name}|${s.phone}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  console.log(`[import-jinys] 총 고유 매장: ${unique.length}`);

  if (DRY_RUN) {
    console.log('\n--- 파싱 결과 (DRY_RUN, DB 쓰기 없음) ---');
    for (const [i, s] of unique.entries()) {
      console.log(
        `${String(i + 1).padStart(3, ' ')}. [${s.region}] ${s.name}  /  ${s.address}  /  ${s.phone}`,
      );
    }
    return;
  }

  // Geocoding — KAKAO_REST_API_KEY 가 있을 때만 좌표 채움
  const useGeocoding = !!process.env.KAKAO_REST_API_KEY;
  if (useGeocoding) {
    console.log('[import-jinys] geocoding 활성화 (KAKAO_REST_API_KEY 감지)');
  } else {
    console.log('[import-jinys] KAKAO_REST_API_KEY 미설정 — 좌표 없이 import (추후 좌표 갱신 가능)');
  }

  // DB upsert (code 기준 — J001 ~ J069)
  let inserted = 0;
  let updated = 0;
  let geocoded = 0;
  let geoFailed = 0;

  for (let i = 0; i < unique.length; i++) {
    const s = unique[i];
    const code = `J${String(i + 1).padStart(3, '0')}`;
    const normalized = normalizeName(s.name);

    let latitude: string | null = null;
    let longitude: string | null = null;

    if (useGeocoding) {
      const geo = await geocodeAddress(s.address);
      if (geo) {
        latitude = String(geo.latitude);
        longitude = String(geo.longitude);
        geocoded++;
      } else {
        geoFailed++;
        console.log(`  ⚠ geocode 실패: ${s.address}`);
      }
      // 카카오 API 제한 회피 — 100ms 텀
      await new Promise((r) => setTimeout(r, 100));
    }

    const existing = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.code, code))
      .limit(1);

    if (existing[0]) {
      const updateSet: Record<string, unknown> = {
        name: normalized,
        phone: s.phone,
        addressLine1: s.address,
        updatedAt: new Date(),
      };
      // 좌표는 있을 때만 갱신 (이미 정확한 좌표가 있는 매장 보호)
      if (latitude && longitude) {
        updateSet.latitude = latitude;
        updateSet.longitude = longitude;
      }
      await db
        .update(stores)
        .set(updateSet)
        .where(eq(stores.id, existing[0].id));
      updated++;
    } else {
      await db.insert(stores).values({
        code,
        name: normalized,
        phone: s.phone,
        addressLine1: s.address,
        latitude,
        longitude,
        commissionRate: '10.00',
        businessNumber: '',
        representativeName: '',
        sortOrder: i + 100, // 기존 시드 3개 (sortOrder 0) 뒤로
      });
      inserted++;
    }

    // 진행률 표시
    if ((i + 1) % 10 === 0 || i === unique.length - 1) {
      console.log(`  진행: ${i + 1}/${unique.length}`);
    }
  }

  console.log(`[import-jinys] inserted: ${inserted}, updated: ${updated}`);
  if (useGeocoding) {
    console.log(`[import-jinys] geocoded: ${geocoded}, failed: ${geoFailed}`);
  }
  console.log('[import-jinys] 완료. /stores 페이지에서 확인 가능.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
