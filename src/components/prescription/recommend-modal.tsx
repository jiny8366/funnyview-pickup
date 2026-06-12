'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDiopter } from '@/lib/prescription/convert';
import { CYCLE_LABEL } from '@/lib/lens/format';

export interface RecommendDose {
  sphere: number;
  cylinder: number | null;
  addPower: number | null;
}

interface Recommended {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  imageUrl: string | null;
  price: number;
  score: number;
  reasons: string[];
}

const DISCOMFORTS = [
  { key: 'dryness', label: '건조함' },
  { key: 'foreign', label: '이물감' },
  { key: 'redness', label: '충혈' },
  { key: 'blur', label: '흐림' },
];

const FEATURES = [
  { key: 'bluelight', label: '블루라이트 차단' },
  { key: 'uv', label: '자외선 차단' },
  { key: 'moisture', label: '수분감' },
];

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const HOUR_OPTIONS = [
  { v: 3, l: '3' },
  { v: 5, l: '5' },
  { v: 7, l: '7' },
  { v: 9, l: '9' },
  { v: 12, l: '12' },
  { v: 13, l: 'OVER' },
];

const TYPE_LABEL: Record<string, string> = {
  spherical: '구면',
  toric: '난시',
  multifocal: '다초점',
};

export function RecommendModal({
  open,
  onClose,
  endpoint,
  dose,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  dose: RecommendDose;
}) {
  const [days, setDays] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [discomforts, setDiscomforts] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [ignore, setIgnore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Recommended[] | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  function toggleIn(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    key: string,
  ) {
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function run() {
    setLoading(true);
    setErr(null);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dose,
        lifestyle: {
          daysPerWeek: days,
          hoursPerDay: hours,
          discomforts: ignore ? [] : discomforts,
          features,
          ignoreLifestyle: ignore,
        },
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr('추천을 불러오지 못했습니다.');
      return;
    }
    const j = await res.json();
    setResults(j.recommendations ?? []);
    setAge(j.age ?? null);
  }

  const doseLabel =
    `SPH ${formatDiopter(dose.sphere)}` +
    (dose.cylinder !== null ? ` · CYL ${formatDiopter(dose.cylinder)}` : '') +
    (dose.addPower !== null ? ` · ADD ${formatDiopter(dose.addPower)}` : '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">최적화 렌즈 추천</h2>
            <p className="mt-0.5 text-xs text-gray-500">기준 도수 · {doseLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 생활환경 입력 */}
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-700">주간 착용일</span>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((dd) => (
                  <button
                    key={dd}
                    type="button"
                    onClick={() => setDays(dd)}
                    disabled={ignore}
                    className={`h-9 w-9 rounded-lg border text-sm font-medium transition disabled:opacity-40 ${
                      days === dd
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {dd}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-700">일 착용시간</span>
              <div className="flex flex-wrap gap-1.5">
                {HOUR_OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setHours(o.v)}
                    disabled={ignore}
                    className={`h-9 min-w-[44px] rounded-lg border px-2 text-sm font-medium transition disabled:opacity-40 ${
                      hours === o.v
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-700">
                기존 렌즈 착용 시 불편함 (복수 선택, 없어도 됨)
              </span>
              <div className="flex flex-wrap gap-2">
                {DISCOMFORTS.map((dc) => (
                  <button
                    key={dc.key}
                    type="button"
                    onClick={() => toggleIn(setDiscomforts, dc.key)}
                    disabled={ignore}
                    className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                      discomforts.includes(dc.key)
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {dc.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-700">
                원하는 기능 (복수 선택)
              </span>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((ft) => (
                  <button
                    key={ft.key}
                    type="button"
                    onClick={() => toggleIn(setFeatures, ft.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      features.includes(ft.key)
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ignore}
                onChange={(e) => setIgnore(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              생활환경과 무관하게 두루 좋은 제품 추천
            </label>

            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? '분석 중...' : '추천받기'}
            </button>
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>

          {/* 결과 */}
          {results && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-3 text-xs font-semibold text-gray-500">
                추천 결과 ({results.length}){age != null ? ` · 만 ${age}세 반영` : ''}
              </p>
              {results.length === 0 ? (
                <p className="text-sm text-gray-400">조건에 맞는 제품을 찾지 못했습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/products/${r.productCode}`}
                        className="flex gap-3 rounded-xl border border-gray-100 p-2.5 hover:border-gray-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl ?? `/api/lens-image/${r.productCode}`}
                          alt={r.name}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-gray-400">{r.brand}</p>
                          <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Tag>{TYPE_LABEL[r.lensType] ?? r.lensType}</Tag>
                            <Tag>{CYCLE_LABEL[r.replacementCycle] ?? r.replacementCycle}</Tag>
                            {r.reasons.slice(0, 3).map((reason) => (
                              <Tag key={reason} accent>
                                {reason}
                              </Tag>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 self-center text-sm font-semibold text-gray-800">
                          {r.price > 0 ? `${r.price.toLocaleString()}원` : ''}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        accent ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  );
}
