'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TestAccountsBox } from '@/components/auth/test-accounts-box';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEST_ACCOUNTS, showTestAccounts } from '@/lib/test-accounts';

export default function WarehouseLoginPage() {
  return (
    <Suspense fallback={null}>
      <WarehouseLoginInner />
    </Suspense>
  );
}

function WarehouseLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/warehouse';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, password, expectedRole: 'warehouse_staff' }),
    });
    setLoading(false);
    if (!res.ok) {
      setError('인증 실패');
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <header>
          <h1 className="text-xl font-bold">픽업관리 로그인</h1>
          <p className="mt-1 text-sm text-emerald-700">Warehouse Portal</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="아이디"
            name="phone"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="비밀번호"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <div className="text-center text-xs text-gray-400">
          <Link href="/" className="hover:underline">처음으로</Link>
        </div>
        {showTestAccounts() && (
          <TestAccountsBox
            accounts={TEST_ACCOUNTS.warehouse}
            onFill={(a) => {
              setPhone(a.phone);
              setPassword(a.password);
            }}
          />
        )}
      </div>
    </main>
  );
}
