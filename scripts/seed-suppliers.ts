/**
 * 매입처(suppliers) 일괄 등록 — JINY 제공 실 거래처(취급 콘택트렌즈 공식 공급처).
 * 멱등: 동일 상호(name)가 이미 있으면 건너뜀 → 재실행/부분입력과 충돌 없음.
 *
 * 실행(prod, M3): DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-suppliers.ts
 * ⚠️ 사업자번호 정확도 — ①아큐브 ③바슈롬 ④인터로조 ⑤미광 = JINY 확정 / ②알콘 = web 후보(추후 확인).
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { suppliers } from '../src/db/schema';

type SupplierSeed = {
  name: string;
  bizNo?: string; // 미확보 시 생략(추후 보완)
  postalCode?: string;
  address: string;
  phone?: string;
  memo: string;
};

const SEEDS: SupplierSeed[] = [
  {
    name: '(주)한국존슨앤드존슨비전',
    bizNo: '569-87-02736',
    address: '서울특별시 용산구 한강대로 92',
    memo: '아큐브(ACUVUE) 콘택트렌즈 공급처 · 대표 이정현(LEE ELIZABETH JUNG)',
  },
  {
    name: '한국알콘(주)',
    bizNo: '116-84-03700', // web 후보 — 추후 확인
    postalCode: '06181',
    address: '서울특별시 강남구 테헤란로 534, 글라스타워빌딩 6층',
    phone: '02-2007-5000',
    memo: '알콘(ALCON) 콘택트렌즈 공급처 · 대표 최준호(web후보) · 비전케어 콜센터 080-566-9202 · alcon_medinfo.asia@alcon.com',
  },
  {
    name: '바슈롬코리아',
    bizNo: '214-81-39122',
    address: '서울특별시 강남구 테헤란로98길 8 (대치동, KOSMO DAECHI) 13층',
    phone: '080-218-6810',
    memo: '바슈롬(Bausch+Lomb) 콘택트렌즈 공급처 · 대표 김형준 · KyungJin.Choi@bausch.com',
  },
  {
    name: '(주)인터로조',
    bizNo: '125-81-34657',
    address: '경기도 평택시 산단로 15번길 25, 28',
    memo: '인터로조(클라렌 CLALEN) 콘택트렌즈 공급처',
  },
  {
    name: '(주)미광콘택트렌즈',
    bizNo: '515-81-35368',
    address: '경상북도 경산시 남천면 남천로 693',
    memo: '미광콘택트렌즈 공급처 · 대표 박종구',
  },
  {
    name: '쿠퍼비전코리아(주)',
    // 사업자번호 미확보(JINY·web 모두 없음) — 추후 보완
    address: '서울특별시 강남구 광평로 281, 수서 오피스빌딩 10층',
    phone: '1688-5401',
    memo: '쿠퍼비전(CooperVision) 콘택트렌즈 공급처 · 대표 박유경(web후보) · info@kr.coopervision.com · 사업자번호 추후입력',
  },
];

async function main() {
  console.log(`=== 매입처 시드 (${SEEDS.length}곳) ===`);
  let inserted = 0;
  let skipped = 0;
  for (const s of SEEDS) {
    const existing = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, s.name)).limit(1);
    if (existing[0]) {
      console.log(`  · 이미 존재(건너뜀): ${s.name}`);
      skipped++;
      continue;
    }
    await db.insert(suppliers).values({
      name: s.name,
      bizNo: s.bizNo ?? null,
      postalCode: s.postalCode ?? null,
      address: s.address,
      phone: s.phone ?? null,
      memo: s.memo,
      isActive: true,
    });
    console.log(`  ✅ 등록: ${s.name} (${s.bizNo ?? '번호 추후'})`);
    inserted++;
  }
  console.log(`완료 — 신규 ${inserted} · 기존 ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('매입처 시드 실패:', e);
  process.exit(1);
});
