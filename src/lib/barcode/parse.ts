/**
 * 바코드 파서 — 1D (EAN-13, GTIN-14, GS1-128) + 2D (GS1 DataMatrix, QR).
 *
 * 정책 (사용자 결정): UDI-DI 정보만 사용. PI (로트/유효기간) 추출은 메타데이터로만.
 *
 * 지원 형식:
 *  - EAN-13         8809123456789               (13자리 숫자)
 *  - GTIN-14        18809123456789              (14자리 숫자, 추가 자릿수)
 *  - GS1-128        ]C1(01)08809123456789(17)271231(10)A2401
 *                   또는 (01)08809123456789(17)271231(10)A2401
 *  - GS1 DataMatrix ]d2(01)08809123456789(17)271231(10)A2401
 *                   FNC1 = ASCII 29 (Group Separator) 또는 괄호 표기
 *  - 변동길이 필드는 GS () 로 종료
 */

/** Application Identifier 추출 결과. 우리는 DI 만 우선 사용. */
export interface ParsedBarcode {
  /** 원본 입력 그대로 (감사 로그용) */
  raw: string;
  /** 정규화된 GTIN-13 (EAN-13 형식, 우리 DB lookup 키) */
  di: string | null;
  /** GTIN-14 원본 (있을 때만) */
  gtin14?: string;
  /** Production Identifiers (참고만, 저장은 선택) */
  pi?: {
    lot?: string;
    expiry?: string; // YYYY-MM-DD
    serial?: string;
    productionDate?: string;
  };
  /** 'ean13' | 'gtin14' | 'gs1-128' | 'gs1-datamatrix' | 'unknown' */
  format: BarcodeFormat;
  /** 파싱 경고/정보 메시지 */
  notes?: string[];
}

export type BarcodeFormat =
  | 'ean13'
  | 'gtin14'
  | 'gs1-128'
  | 'gs1-datamatrix'
  | 'unknown';

const FNC1 = ''; // GS Group Separator

/**
 * GS1 AI (Application Identifier) 정의 — 우리가 다루는 것만.
 * length: 고정 길이 (null = 가변, FNC1/괄호 종료)
 */
const GS1_AI: Record<string, { length: number | null; key: keyof NonNullable<ParsedBarcode['pi']> | 'gtin' }> = {
  '01': { length: 14, key: 'gtin' }, // GTIN-14
  '17': { length: 6, key: 'expiry' }, // 유효기간 YYMMDD
  '11': { length: 6, key: 'productionDate' }, // 제조일 YYMMDD
  '10': { length: null, key: 'lot' }, // 로트 (가변)
  '21': { length: null, key: 'serial' }, // 일련번호 (가변)
};

export function parseBarcode(raw: string): ParsedBarcode {
  const input = raw.trim();
  if (!input) {
    return { raw, di: null, format: 'unknown', notes: ['EMPTY'] };
  }

  // Symbology Identifier prefix 제거 (스캐너 설정에 따라 붙음)
  // ]C1 = GS1-128, ]d2 = GS1 DataMatrix, ]E0 = EAN-13
  let body = input.replace(/^\][A-Za-z]\d/, '');

  // [Case A] 순수 숫자 — EAN-13 (13자리) 또는 GTIN-14 (14자리)
  if (/^\d{13}$/.test(body)) {
    return {
      raw,
      di: body,
      format: 'ean13',
      notes: ['EAN-13'],
    };
  }
  if (/^\d{14}$/.test(body)) {
    return {
      raw,
      di: gtin14To13(body),
      gtin14: body,
      format: 'gtin14',
      notes: ['GTIN-14 → EAN-13 변환'],
    };
  }

  // [Case B] GS1 (괄호 표기 또는 FNC1) — (01)... 또는 01...
  if (body.startsWith('(') || /^\d{2,}/.test(body)) {
    const result = parseGs1(body, input);
    if (result.di) return result;
  }

  return {
    raw,
    di: null,
    format: 'unknown',
    notes: ['지원하지 않는 바코드 형식 — 13/14자리 숫자 또는 GS1 표기 필요'],
  };
}

/**
 * GS1-128 / GS1 DataMatrix AI 스트림 파싱.
 * 입력 형식:
 *   - 괄호: (01)08809123456789(17)271231(10)A2401
 *   - FNC1: 0108809123456789172712311A2401[FNC1]
 *   - 혼합도 허용.
 */
function parseGs1(stream: string, raw: string): ParsedBarcode {
  // 괄호 표기로 통일
  const normalized = stream.includes('(')
    ? stream
    : insertParens(stream);

  const re = /\((\d{2,4})\)([^(]+)/g;
  let m: RegExpExecArray | null;
  let gtin: string | undefined;
  const pi: NonNullable<ParsedBarcode['pi']> = {};
  const notes: string[] = ['GS1'];

  while ((m = re.exec(normalized)) !== null) {
    const ai = m[1];
    let value = m[2].replace(new RegExp(FNC1, 'g'), '').trim();

    const def = GS1_AI[ai];
    if (!def) {
      notes.push(`unknown AI(${ai}) — skipped`);
      continue;
    }

    // 고정 길이 필드: 앞부분만 잘라쓰기
    if (def.length != null && value.length > def.length) {
      value = value.slice(0, def.length);
    }

    if (def.key === 'gtin') {
      gtin = value;
    } else if (def.key === 'expiry' || def.key === 'productionDate') {
      pi[def.key] = expandYYMMDD(value);
    } else {
      pi[def.key] = value;
    }
  }

  if (!gtin) {
    return {
      raw,
      di: null,
      format: 'unknown',
      notes: [...notes, 'GTIN (AI 01) 없음'],
    };
  }

  const di = gtin.length === 14 ? gtin14To13(gtin) : gtin.length === 13 ? gtin : null;

  return {
    raw,
    di,
    gtin14: gtin.length === 14 ? gtin : undefined,
    pi: Object.keys(pi).length > 0 ? pi : undefined,
    format: stream.includes(FNC1) || raw.startsWith(']d2') ? 'gs1-datamatrix' : 'gs1-128',
    notes,
  };
}

/**
 * 괄호 없는 FNC1 스트림에 (AI) 괄호 삽입.
 *   '0108809123456789172712311A2401' → '(01)08809123456789(17)271231(10)A2401'
 */
function insertParens(stream: string): string {
  let s = stream;
  let out = '';
  while (s.length >= 2) {
    const ai = s.slice(0, 2);
    const def = GS1_AI[ai];
    if (!def) {
      // 알 수 없는 AI — 더 진행 안 함
      out += s;
      break;
    }
    s = s.slice(2);
    out += `(${ai})`;
    if (def.length != null) {
      out += s.slice(0, def.length);
      s = s.slice(def.length);
    } else {
      // 가변 길이 — FNC1 까지 또는 끝까지
      const fncIdx = s.indexOf(FNC1);
      if (fncIdx >= 0) {
        out += s.slice(0, fncIdx);
        s = s.slice(fncIdx + 1);
      } else {
        out += s;
        s = '';
      }
    }
  }
  return out;
}

/**
 * GTIN-14 → GTIN-13 변환 (선두 0 제거).
 * 14자리 GTIN 의 첫 자리가 packaging indicator (0=consumer unit, 1-8=trade pack).
 * Consumer EAN-13 매칭을 위해 첫 자리가 0 이면 제거.
 */
function gtin14To13(gtin14: string): string {
  if (gtin14.length !== 14) return gtin14;
  if (gtin14.startsWith('0')) return gtin14.slice(1);
  return gtin14; // packaging indicator 가 0 이 아니면 (다단위 박스) 그대로
}

/**
 * YYMMDD → YYYY-MM-DD (DD=00 이면 해당 월 말일).
 * YY < 50: 2000년대 / YY >= 50: 1900년대 (GS1 표준)
 */
function expandYYMMDD(s: string): string {
  if (!/^\d{6}$/.test(s)) return s;
  const yy = Number(s.slice(0, 2));
  const mm = s.slice(2, 4);
  let dd = s.slice(4, 6);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  if (dd === '00') {
    // 해당 월의 마지막 날
    dd = String(new Date(year, Number(mm), 0).getDate()).padStart(2, '0');
  }
  return `${year}-${mm}-${dd}`;
}
