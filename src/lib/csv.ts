/**
 * 의존성 없는 CSV 직렬화/파싱 (엑셀 호환). 다운로드 시 BOM 을 붙여 한글 깨짐 방지.
 */

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(escapeCsv).join(',');
  const body = rows
    .map((r) => headers.map((h) => escapeCsv(r[h])).join(','))
    .join('\r\n');
  return '﻿' + head + (body ? '\r\n' + body : '') + '\r\n';
}

/** RFC 4180 간이 파서 — 따옴표 안의 콤마/개행/이스케이프("") 처리. */
export function parseCsv(text: string): Record<string, string>[] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== '')) rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}
