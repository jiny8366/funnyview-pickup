'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  id: string;
  isSelf?: boolean;
  isMaster?: boolean;
}

export function StaffDeleteButton({ id, isSelf, isMaster }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const disabled = busy || isSelf || isMaster;

  async function onClick() {
    if (disabled) return;
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

  const title = isMaster
    ? '마스터 계정은 삭제할 수 없습니다'
    : isSelf
      ? '본인 계정은 비활성화할 수 없습니다'
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? '처리 중…' : '계정 삭제'}
    </button>
  );
}
