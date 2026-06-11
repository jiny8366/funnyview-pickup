/**
 * 멀티포컬 ADD 표준 동결 검증 — 🔒 JINY 확정 (2026-06-11).
 *
 * multifocal-add-standard.ts 의 수치가 제조사 공식 피팅 가이드와 일치하는지,
 * 대표 처방 케이스의 판정이 기대대로인지 고정 검사한다.
 * 표준을 임의 변경하면 이 스크립트가 실패한다 — 변경은 JINY 승인 + spec.json 동시 수정 필수.
 *
 * 실행: npx tsx scripts/verify-multifocal-standard.ts  (DB 불필요 — 순수 함수)
 */
import {
  ADD_FIT_ABOVE,
  ADD_FIT_BELOW,
  GRADE_CHARTS,
  fitsGrade,
  fitsNumeric,
  gradeChartForBrand,
  parseAddGrade,
} from '../src/lib/prescription/multifocal-add-standard';

let failed = 0;
function check(label: string, cond: boolean) {
  if (!cond) {
    failed += 1;
    console.error(`✗ ${label}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// ── 1. 차트 수치 동결 (제조사 공식 피팅 가이드와 1:1) ──
check('알콘 LOW = +0.75~+1.25', GRADE_CHARTS.alcon.LOW[0] === 0.75 && GRADE_CHARTS.alcon.LOW[1] === 1.25);
check('알콘 MID = +1.50~+2.00', GRADE_CHARTS.alcon.MID[0] === 1.5 && GRADE_CHARTS.alcon.MID[1] === 2.0);
check('알콘 HIGH = +2.25~+2.50', GRADE_CHARTS.alcon.HIGH[0] === 2.25 && GRADE_CHARTS.alcon.HIGH[1] === 2.5);
check('아큐브 LOW = +0.75~+1.25', GRADE_CHARTS.jnj.LOW[0] === 0.75 && GRADE_CHARTS.jnj.LOW[1] === 1.25);
check('아큐브 MID = +1.50~+1.75', GRADE_CHARTS.jnj.MID[0] === 1.5 && GRADE_CHARTS.jnj.MID[1] === 1.75);
check('아큐브 HIGH = +2.00~+2.50', GRADE_CHARTS.jnj.HIGH[0] === 2.0 && GRADE_CHARTS.jnj.HIGH[1] === 2.5);
check('바슈롬 LOW = +0.75~+1.50', GRADE_CHARTS.bausch.LOW![0] === 0.75 && GRADE_CHARTS.bausch.LOW![1] === 1.5);
check('바슈롬 HIGH = +1.75~+2.50', GRADE_CHARTS.bausch.HIGH![0] === 1.75 && GRADE_CHARTS.bausch.HIGH![1] === 2.5);
check('바슈롬 MID 없음(2등급)', GRADE_CHARTS.bausch.MID === undefined);
check('수치 허용 = [−0.25, +0.50] 비대칭', ADD_FIT_BELOW === 0.25 && ADD_FIT_ABOVE === 0.5);

// ── 2. 브랜드 → 차트 매핑 ──
check('브랜드 바슈롬 → 2등급 차트', gradeChartForBrand('바슈롬').MID === undefined);
check('브랜드 아큐브 → J&J 차트', gradeChartForBrand('아큐브').MID?.[1] === 1.75);
check('브랜드 알콘/기타 → 알콘 차트', gradeChartForBrand('알콘').MID?.[1] === 2.0);

// ── 3. 등급 토큰 파싱 ──
check("'…멀티포컬 30P(LOW)' → LOW", parseAddGrade('데일리스 토탈원 멀티포컬 30P(LOW)', 'X') === 'LOW');
check("'…6P(MED)' → MID", parseAddGrade('에어옵틱스 하이드라 멀티포컬 6P(MED)', 'X') === 'MID');
check("'…6P(HIG)' 절단표기 → HIGH", parseAddGrade('에어옵틱스 하이드라 멀티포컬 6P(HIG)', 'X') === 'HIGH');
check("코드 접미 '-L' → LOW", parseAddGrade('바이오트루멀티포컬', 'BNL-BTM1D-30P-L') === 'LOW');
check('등급 토큰 없음 → null', parseAddGrade('프로클리어 원데이 멀티포컬', 'COO-PCM1D-1P') === null);

// ── 4. 대표 처방 판정 (문제 사례 회귀 방지) ──
// JINY 발견 사례: 처방 +1.00 에 높은 ADD 추천 — LOW 만 적합해야 한다.
check('처방 +1.00: 알콘 LOW 적합', fitsGrade(GRADE_CHARTS.alcon.LOW, 1.0));
check('처방 +1.00: 알콘 MID 부적합', !fitsGrade(GRADE_CHARTS.alcon.MID, 1.0));
check('처방 +1.00: 알콘 HIGH 부적합', !fitsGrade(GRADE_CHARTS.alcon.HIGH, 1.0));
check('처방 +1.00: 바슈롬 HIGH 부적합', !fitsGrade(GRADE_CHARTS.bausch.HIGH!, 1.0));
// 아큐브 공식: +2.00 은 HIGH (MID 상한 +1.75)
check('처방 +2.00: 아큐브 HIGH 적합', fitsGrade(GRADE_CHARTS.jnj.HIGH, 2.0));
check('처방 +2.00: 아큐브 MID 부적합', !fitsGrade(GRADE_CHARTS.jnj.MID, 2.0));
// 알콘 공식: +2.00 은 MED
check('처방 +2.00: 알콘 MED 적합', fitsGrade(GRADE_CHARTS.alcon.MID, 2.0));
// 바슈롬 공식: +1.50 은 LOW
check('처방 +1.50: 바슈롬 LOW 적합', fitsGrade(GRADE_CHARTS.bausch.LOW!, 1.5));
// 범위 밖 클램프
check('처방 +0.50(하한 밖) → LOW 적합', fitsGrade(GRADE_CHARTS.alcon.LOW, 0.5));
check('처방 +3.00(상한 밖) → HIGH 적합', fitsGrade(GRADE_CHARTS.alcon.HIGH, 3.0));
// 수치형 (아큐브 DB 수치: 1.25/1.75/2.50)
check('수치: 처방 +1.00 → ADD 1.25 적합', fitsNumeric([1.25], 1.0));
check('수치: 처방 +1.00 → ADD 1.75 부적합', !fitsNumeric([1.75], 1.0));
check('수치: 처방 +2.50 → ADD 2.50 적합', fitsNumeric([2.5], 2.5));

if (failed > 0) {
  console.error(`\n❌ ${failed}건 실패 — 멀티포컬 ADD 표준이 동결값과 다릅니다. (JINY 승인 없이 변경 금지)`);
  process.exit(1);
}
console.log('\n✅ 멀티포컬 ADD 표준 동결 검증 통과');
