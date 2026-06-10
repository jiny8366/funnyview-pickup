'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils/format';

interface Notif {
  id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  sentAt: string | null;
  failedReason: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  sent: 'text-emerald-700 bg-emerald-50',
  delivered: 'text-emerald-700 bg-emerald-50',
  failed: 'text-red-700 bg-red-50',
  pending: 'text-amber-700 bg-amber-50',
};
const STATUS_LABEL: Record<string, string> = {
  sent: '발송', delivered: '전달', failed: '실패', pending: '대기',
};

/**
 * 주문별 고객 알림 발송 이력 (운영화면 — 보드 #9).
 * "고객에게 알림이 실제 나갔는지" 확인해 클레임 대응. 펼칠 때 지연 로드.
 * 권한: admin·warehouse=전체 / store=자기매장 (API 가 강제).
 */
export function NotificationHistory({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || items) return;
    fetch(`/api/orders/${orderId}/notifications`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setItems(j.notifications ?? []))
      .catch(() => setErr('알림 이력을 불러오지 못했습니다'));
  }, [open, items, orderId]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900"
      >
        <span>🔔 고객 알림 발송 이력</span>
        <span className="text-gray-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          {err && <div className="text-xs text-red-600">{err}</div>}
          {!err && !items && <div className="text-xs text-gray-400">불러오는 중…</div>}
          {items && items.length === 0 && (
            <div className="text-xs text-gray-400">발송된 알림이 없습니다</div>
          )}
          {items && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {n.channel}
                      {' · '}
                      {formatDateTime(n.sentAt ?? n.createdAt)}
                      {n.status === 'failed' && n.failedReason ? ` · ${n.failedReason}` : ''}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[n.status] ?? 'text-gray-600 bg-gray-100'}`}
                  >
                    {STATUS_LABEL[n.status] ?? n.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
