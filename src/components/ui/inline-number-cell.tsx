'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 리스트 셀 클릭 → 인라인 숫자 편집 (frame-ops 패턴 차용 — JINY).
 * 클릭하면 입력으로 전환, Enter/blur 로 저장, Esc 취소. 값이 그대로면 저장 호출 안 함.
 * canEdit=false 면 정적 표시 (권한 없는 사용자).
 */
export function InlineNumberCell({
  value,
  canEdit,
  onSave,
  min = 0,
  suffix,
  className = '',
  title,
}: {
  value: number;
  canEdit: boolean;
  onSave: (next: number) => Promise<void> | void;
  min?: number;
  suffix?: string;
  className?: string;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < min || n === value) {
      setEditing(false);
      setDraft(String(value));
      return;
    }
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (!canEdit) {
    return (
      <span className={className} title={title ?? '수정 권한이 없습니다'}>
        {value}
        {suffix}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        title={title ?? '클릭하여 수정'}
        className={`cursor-pointer rounded px-1 py-0.5 underline decoration-dotted underline-offset-2 hover:bg-amber-50 ${className}`}
      >
        {value}
        {suffix}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      inputMode="numeric"
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9-]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(String(value));
          setEditing(false);
        }
      }}
      className="w-16 rounded border border-amber-400 bg-white px-1 py-0.5 text-right text-sm focus:outline-none disabled:opacity-50"
    />
  );
}
