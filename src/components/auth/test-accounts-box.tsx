'use client';

import { useState } from 'react';
import { type TestAccount } from '@/lib/test-accounts';

export function TestAccountsBox({
  accounts,
  onFill,
}: {
  accounts: TestAccount[];
  onFill: (acc: TestAccount) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs" open>
      <summary className="cursor-pointer select-none font-medium text-amber-900">
        🔑 테스트 계정 ({accounts.length}개) — 클릭하여 자동 입력
      </summary>
      <ul className="mt-2 space-y-1.5">
        {accounts.map((a) => (
          <li
            key={a.phone}
            className={
              a.primary
                ? 'flex items-center justify-between gap-2 rounded-lg border-2 border-brand-500 bg-brand-50 px-2.5 py-1.5'
                : 'flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5'
            }
          >
            <button
              type="button"
              onClick={() => onFill(a)}
              className="min-w-0 flex-1 text-left"
            >
              <div className={a.primary ? 'truncate font-bold text-brand-700' : 'truncate font-medium text-gray-900'}>
                {a.primary && '⭐ '}
                {a.label}
              </div>
              <div className={a.primary ? 'truncate font-mono text-[11px] font-semibold text-brand-700' : 'truncate font-mono text-[10px] text-gray-500'}>
                {a.phone} · {a.password}
              </div>
              {a.hint && (
                <div className={a.primary ? 'mt-0.5 truncate text-[10px] text-brand-600' : 'mt-0.5 truncate text-[10px] text-gray-400'}>
                  {a.hint}
                </div>
              )}
            </button>
            <div className="flex shrink-0 gap-0.5">
              <button
                type="button"
                onClick={() => copy(a.phone, a.phone + '_p')}
                className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100"
                title="아이디 복사"
              >
                {copied === a.phone + '_p' ? '✓' : 'ID'}
              </button>
              <button
                type="button"
                onClick={() => copy(a.password, a.phone + '_pw')}
                className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100"
                title="비밀번호 복사"
              >
                {copied === a.phone + '_pw' ? '✓' : 'PW'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-amber-800">
        🧪 dev/preview 표시 — 운영(default)에서는 숨겨집니다. .env 에 NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=1 로 표시.
      </p>
    </details>
  );
}
