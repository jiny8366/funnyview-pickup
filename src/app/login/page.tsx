'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TestAccountsBox } from '@/components/auth/test-accounts-box';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { TEST_ACCOUNTS, showTestAccounts } from '@/lib/test-accounts';

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginInner />
    </Suspense>
  );
}

function CustomerLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/customer';

  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: id, password: pw, expectedRole: 'customer' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(errorMessage(body.error));
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 md:py-16">
      <Breadcrumb items={[{ href: '/', label: '홈' }, { label: '로그인' }]} />

      <h1 className="mt-8 text-center text-2xl font-bold text-gray-900">로그인</h1>

      <form onSubmit={onSubmit} className="mt-10 space-y-3">
        <input
          type="text"
          autoComplete="username"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="아이디"
          required
          autoFocus
          className="cafe-input"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          required
          className="cafe-input"
        />

        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
            <span className={secure ? 'text-red-600' : 'text-gray-400'}>🔒</span>
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="sr-only"
            />
            보안접속
          </label>
          <div className="flex items-center gap-3 text-gray-600">
            <button type="button" className="hover:text-gray-900" onClick={() => alert('아이디 찾기 — 추후 활성화')}>
              아이디찾기
            </button>
            <span className="text-gray-300">|</span>
            <button type="button" className="hover:text-gray-900" onClick={() => alert('비밀번호 찾기 — 추후 활성화')}>
              비밀번호찾기
            </button>
            <span className="text-gray-300">|</span>
            <Link href="/register" className="hover:text-gray-900">
              회원가입
            </Link>
          </div>
        </div>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-14 w-full rounded-md bg-black text-base font-semibold text-white transition hover:bg-gray-800 disabled:bg-gray-400"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <SocialIconButtons returnTo={next} />

      {showTestAccounts() && (
        <TestAccountsBox
          accounts={TEST_ACCOUNTS.customer}
          onFill={(a) => {
            setId(a.phone);
            setPw(a.password);
          }}
        />
      )}
    </main>
  );
}

const SOCIAL_ICON_ORDER = ['kakao', 'naver', 'google'];
const SOCIAL_ICON_META: Record<string, { bg: string; node: React.ReactNode; label: string }> = {
  kakao: { bg: 'bg-[#FEE500]', node: <span className="text-lg">💬</span>, label: '카카오' },
  naver: { bg: 'bg-[#03C75A]', node: <span className="text-lg font-bold text-white">N</span>, label: '네이버' },
  google: {
    bg: 'bg-white border border-gray-300',
    node: <span className="text-lg font-bold text-gray-700">G</span>,
    label: '구글',
  },
};

function SocialIconButtons({ returnTo }: { returnTo?: string }) {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/auth/oauth/providers')
      .then((r) => r.json())
      .then((d) => setProviders(Array.isArray(d?.providers) ? d.providers : []))
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="mt-10 flex items-center justify-center gap-4">
      {SOCIAL_ICON_ORDER.filter((p) => providers.includes(p)).map((p) => {
        const m = SOCIAL_ICON_META[p];
        return (
          <SocialIcon key={p} href={`/api/auth/oauth/${p}/start${query}`} bg={m.bg} label={m.label}>
            {m.node}
          </SocialIcon>
        );
      })}
    </div>
  );
}

function SocialIcon({
  href,
  bg,
  label,
  children,
}: {
  href: string;
  bg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={`grid h-14 w-14 place-items-center rounded-full ${bg} transition hover:opacity-90`}
    >
      {children}
    </a>
  );
}

function errorMessage(code?: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return '아이디 또는 비밀번호가 올바르지 않습니다';
    case 'ROLE_MISMATCH':
      return '고객 계정으로 로그인해주세요';
    case 'INACTIVE_USER':
      return '비활성화된 계정입니다';
    default:
      return '로그인에 실패했습니다';
  }
}
