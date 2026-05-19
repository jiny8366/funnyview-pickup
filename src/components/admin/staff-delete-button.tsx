'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  id: string;
  isSelf?: boolean;
}

export function StaffDeleteButton({ id, isSelf }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (isSelf) return;
    if (!window.confirm('이 계정을 비활성화합니다. 계속하시겠어요?')) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body.error ?? '삭제 실패');
        return;
      }
      router.push('/admin/staff');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || isSelf}
      title={isSelf ? '본인 계정은 비활성화할 수 없습니다' : undefined}
      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? '처리 중…' : '계정 삭제'}
    </button>
  );
}
