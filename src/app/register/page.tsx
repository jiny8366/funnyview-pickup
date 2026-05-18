'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Breadcrumb } from '@/components/layout/breadcrumb';

interface FormState {
  email: string;
  username: string;
  password: string;
  passwordConfirm: string;
  name: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  landlinePrefix: string;
  landlineMid: string;
  landlineLast: string;
  phonePrefix: string;
  phoneMid: string;
  phoneLast: string;
  referredByCode: string;
  refundHolder: string;
  refundBank: string;
  refundAccount: string;
  phoneVerified: boolean;
}

const EMPTY: FormState = {
  email: '',
  username: '',
  password: '',
  passwordConfirm: '',
  name: '',
  postalCode: '',
  addressLine1: '',
  addressLine2: '',
  landlinePrefix: '02',
  landlineMid: '',
  landlineLast: '',
  phonePrefix: '010',
  phoneMid: '',
  phoneLast: '',
  referredByCode: '',
  refundHolder: '',
  refundBank: '',
  refundAccount: '',
  phoneVerified: false,
};

const LANDLINE_PREFIXES = ['02', '031', '032', '033', '041', '042', '043', '044', '051', '052', '053', '054', '055', '061', '062', '063', '064', '070'];
const MOBILE_PREFIXES = ['010', '011', '016', '017', '018', '019'];
const BANKS = ['KB국민', '신한', '우리', '하나', 'NH농협', 'IBK기업', 'SC제일', '카카오뱅크', '토스뱅크', '케이뱅크', '새마을금고', '신협', '우체국', '한국씨티'];

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function verifyPhone() {
    // 본 구현은 데모 — 실제 PASS / NICE 본인인증 연동은 별도 작업
    if (!f.phoneMid || !f.phoneLast) {
      alert('휴대전화 번호를 먼저 입력해주세요');
      return;
    }
    update('phoneVerified', true);
    alert('휴대폰 인증 완료 (데모 모드 — 실제 PASS 연동은 추후)');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.phoneVerified) {
      setError('휴대폰 인증을 진행해주세요');
      return;
    }
    if (f.password !== f.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    const phone = `${f.phonePrefix}${f.phoneMid}${f.phoneLast}`;
    const landlinePhone =
      f.landlineMid && f.landlineLast
        ? `${f.landlinePrefix}${f.landlineMid}${f.landlineLast}`
        : null;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: f.email,
          username: f.username,
          password: f.password,
          passwordConfirm: f.passwordConfirm,
          name: f.name,
          phone,
          landlinePhone,
          postalCode: f.postalCode || null,
          addressLine1: f.addressLine1 || null,
          addressLine2: f.addressLine2 || null,
          memberType: 'individual',
          referredByCode: f.referredByCode || null,
          refundBank:
            f.refundHolder || f.refundBank || f.refundAccount
              ? {
                  holder: f.refundHolder,
                  bank: f.refundBank,
                  account: f.refundAccount,
                }
              : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error));
        return;
      }
      router.replace('/');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function searchAddress() {
    // Daum 주소검색 (Postcode) 연동은 별도 작업. 임시 alert.
    const postal = prompt('우편번호 (테스트용 — 추후 Daum 주소검색 연동)');
    const addr = prompt('기본 주소');
    if (postal) update('postalCode', postal);
    if (addr) update('addressLine1', addr);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <Breadcrumb items={[{ href: '/', label: '홈' }, { label: '회원 가입' }]} />

      <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">회원 가입</h1>

      {/* 소셜 가로 3개 */}
      <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SocialBar href="/api/auth/oauth/naver/start" bg="bg-[#03C75A]" textColor="text-white" prefix="N" label="네이버 로그인" />
        <SocialBar href="/api/auth/oauth/kakao/start" bg="bg-[#FEE500]" textColor="text-black" prefix="💬" label="카카오로 시작하기" />
        <SocialBar href="/api/auth/oauth/google/start" bg="bg-black" textColor="text-white" prefix="" label="Apple로 로그인" />
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        {/* 회원 구분 */}
        <Section>
          <Row label="회원구분" required>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked readOnly className="h-4 w-4" />
              개인회원
            </label>
          </Row>
          <Row label="회원인증" required>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="radio" checked readOnly className="h-4 w-4" />
                휴대폰인증
              </label>
              <div>
                <button
                  type="button"
                  onClick={verifyPhone}
                  className={`inline-flex h-9 items-center gap-1.5 rounded border px-3 text-sm ${f.phoneVerified ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  📱 {f.phoneVerified ? '휴대폰 인증 완료' : '휴대폰인증'}
                </button>
              </div>
              <p className="text-xs text-gray-500">본인 명의의 휴대폰으로 본인인증을 진행합니다.</p>
            </div>
          </Row>
        </Section>

        {/* 기본 정보 */}
        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold text-gray-900">기본정보</h2>
            <span className="text-xs text-blue-600">
              <span className="mr-0.5">*</span>필수입력사항
            </span>
          </div>
          <Section>
            <Row label="이메일" required>
              <input
                type="email"
                value={f.email}
                onChange={(e) => update('email', e.target.value)}
                required
                className="cafe-input-sm max-w-sm"
              />
            </Row>
            <Row label="아이디" required>
              <div className="space-y-1">
                <input
                  type="text"
                  value={f.username}
                  onChange={(e) => update('username', e.target.value.replace(/[^a-z0-9]/g, '').slice(0, 16))}
                  required
                  className="cafe-input-sm max-w-sm"
                />
                <p className="text-xs text-gray-500">(영문소문자/숫자, 4~16자)</p>
              </div>
            </Row>
            <Row label="비밀번호" required>
              <div className="space-y-1">
                <input
                  type="password"
                  value={f.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  className="cafe-input-sm max-w-sm"
                />
                <p className="text-xs text-gray-500">
                  (영문 대소문자/숫자/특수문자 중 3가지 이상 조합, 8자~16자)
                </p>
              </div>
            </Row>
            <Row label="비밀번호 확인" required>
              <input
                type="password"
                value={f.passwordConfirm}
                onChange={(e) => update('passwordConfirm', e.target.value)}
                required
                className="cafe-input-sm max-w-sm"
              />
            </Row>
            <Row label="이름" required>
              <input
                type="text"
                value={f.name}
                onChange={(e) => update('name', e.target.value)}
                required
                className="cafe-input-sm max-w-sm"
              />
            </Row>
            <Row label="주소">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={f.postalCode}
                    onChange={(e) => update('postalCode', e.target.value)}
                    placeholder="우편번호"
                    className="cafe-input-sm w-32"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={searchAddress}
                    className="h-9 rounded border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    주소검색
                  </button>
                </div>
                <input
                  type="text"
                  value={f.addressLine1}
                  onChange={(e) => update('addressLine1', e.target.value)}
                  placeholder="기본주소"
                  className="cafe-input-sm max-w-2xl"
                  readOnly
                />
                <input
                  type="text"
                  value={f.addressLine2}
                  onChange={(e) => update('addressLine2', e.target.value)}
                  placeholder="나머지 주소(선택 입력 가능)"
                  className="cafe-input-sm max-w-2xl"
                />
              </div>
            </Row>
            <Row label="일반전화">
              <PhoneSplitInput
                prefix={f.landlinePrefix}
                mid={f.landlineMid}
                last={f.landlineLast}
                prefixOptions={LANDLINE_PREFIXES}
                onPrefix={(v) => update('landlinePrefix', v)}
                onMid={(v) => update('landlineMid', v)}
                onLast={(v) => update('landlineLast', v)}
              />
            </Row>
            <Row label="휴대전화" required>
              <PhoneSplitInput
                prefix={f.phonePrefix}
                mid={f.phoneMid}
                last={f.phoneLast}
                prefixOptions={MOBILE_PREFIXES}
                onPrefix={(v) => update('phonePrefix', v)}
                onMid={(v) => update('phoneMid', v)}
                onLast={(v) => update('phoneLast', v)}
              />
            </Row>
          </Section>
        </div>

        {/* 추가 정보 */}
        <div>
          <h2 className="mb-3 text-lg font-bold text-gray-900">추가정보</h2>
          <Section>
            <Row label="추천인 아이디">
              <input
                type="text"
                value={f.referredByCode}
                onChange={(e) => update('referredByCode', e.target.value)}
                className="cafe-input-sm max-w-sm"
              />
            </Row>
            <Row label="환불계좌 정보">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-700">· 예금주</span>
                  <input
                    type="text"
                    value={f.refundHolder}
                    onChange={(e) => update('refundHolder', e.target.value)}
                    className="cafe-input-sm max-w-xs"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-700">· 은행명</span>
                  <select
                    value={f.refundBank}
                    onChange={(e) => update('refundBank', e.target.value)}
                    className="cafe-input-sm max-w-xs"
                  >
                    <option value="">- 은행선택 -</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-700">· 계좌번호</span>
                  <div>
                    <input
                      type="text"
                      value={f.refundAccount}
                      onChange={(e) => update('refundAccount', e.target.value.replace(/[^0-9-]/g, ''))}
                      className="cafe-input-sm max-w-xs"
                    />
                    <p className="mt-0.5 text-[11px] text-gray-500">('-'와 숫자만 입력해주세요.)</p>
                  </div>
                </div>
              </div>
            </Row>
          </Section>
        </div>

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-12 min-w-[120px] rounded border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-12 min-w-[140px] rounded bg-black px-6 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            {submitting ? '가입 중...' : '가입하기'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <div className="divide-y divide-gray-200 bg-white">{children}</div>
    </div>
  );
}

function Row({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-2 px-4 py-3 sm:grid-cols-[160px_1fr] sm:gap-4 sm:px-5 sm:py-3.5">
      <div className="text-sm font-medium text-gray-800">
        {label}
        {required && <span className="ml-0.5 text-blue-600">*</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function PhoneSplitInput({
  prefix,
  mid,
  last,
  prefixOptions,
  onPrefix,
  onMid,
  onLast,
}: {
  prefix: string;
  mid: string;
  last: string;
  prefixOptions: string[];
  onPrefix: (v: string) => void;
  onMid: (v: string) => void;
  onLast: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={prefix}
        onChange={(e) => onPrefix(e.target.value)}
        className="cafe-input-sm w-20"
      >
        {prefixOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <span className="text-gray-400">-</span>
      <input
        type="text"
        value={mid}
        onChange={(e) => onMid(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        maxLength={4}
        className="cafe-input-sm w-24 text-center"
      />
      <span className="text-gray-400">-</span>
      <input
        type="text"
        value={last}
        onChange={(e) => onLast(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        maxLength={4}
        className="cafe-input-sm w-24 text-center"
      />
    </div>
  );
}

function SocialBar({
  href,
  bg,
  textColor,
  prefix,
  label,
}: {
  href: string;
  bg: string;
  textColor: string;
  prefix: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className={`flex h-12 items-center justify-center gap-2 rounded-md ${bg} ${textColor} text-sm font-semibold transition hover:opacity-90`}
    >
      {prefix && <span className="text-base">{prefix}</span>}
      {label}
    </a>
  );
}

function errorMessage(code?: string): string {
  switch (code) {
    case 'INVALID_INPUT':
      return '입력값을 확인해주세요';
    case 'PHONE_TAKEN':
      return '이미 가입된 휴대전화입니다';
    case 'USERNAME_TAKEN':
      return '이미 사용 중인 아이디입니다';
    case 'EMAIL_TAKEN':
      return '이미 가입된 이메일입니다';
    case 'PASSWORD_MISMATCH':
      return '비밀번호가 일치하지 않습니다';
    default:
      return '가입 처리 중 오류가 발생했습니다';
  }
}
