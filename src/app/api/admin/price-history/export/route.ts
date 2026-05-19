import { getCurrentUser } from '@/lib/auth/current-user';
import { hasPermission } from '@/lib/auth/permissions';
import { fetchPriceHistory } from '@/lib/price-history';
import type { PriceScope } from '@/db/schema';

export const dynamic = 'force-dynamic';

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return new Response('FORBIDDEN', { status: 403 });
  if (!me.isMaster && !hasPermission(me.permissions, 'price_history_view')) {
    return new Response('FORBIDDEN', { status: 403 });
  }

  const url = new URL(req.url);
  const lensId = url.searchParams.get('lensId') ?? undefined;
  const scope = (url.searchParams.get('scope') as PriceScope | null) ?? undefined;

  const rows = await fetchPriceHistory({ limit: 5000, offset: 0, lensId, scope });

  const headers = [
    '제품명',
    '제품코드',
    '구분',
    '변경일시',
    '적용시작',
    '적용종료',
    '표준가',
    '할인금액',
    '할인%',
    '실효가',
    '이전실효가',
    '변동액',
    '담당자',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.productName),
        csvEscape(r.productCode),
        csvEscape(r.scopeLabel),
        csvEscape(r.createdAt),
        csvEscape(r.startsAt),
        csvEscape(r.endsAt ?? ''),
        csvEscape(r.standard),
        csvEscape(r.discountAmount),
        csvEscape(r.discountPercent),
        csvEscape(r.effective),
        csvEscape(r.prevEffective ?? ''),
        csvEscape(r.delta ?? ''),
        csvEscape(r.createdByLabel),
      ].join(','),
    );
  }

  // 한국 엑셀 호환 — UTF-8 BOM 추가
  const csv = '﻿' + lines.join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="price-history-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
