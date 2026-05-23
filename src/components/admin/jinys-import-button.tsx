'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DryRunResult {
  summary: { pages: number; parsed: number; errors: number };
  errors: string[];
  sample: Array<{ region: string; name: string; address: string; phone: string }>;
}

interface ImportResult {
  summary: {
    pagesFetched: number;
    parsed: number;
    inserted: number;
    updated: number;
    testDeleted: string[];
    activeStoresAfter: number;
  };
  fetchErrors: string[];
  writeErrors: string[];
}

export function JinysImportButton() {
  const router = useRouter();
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle');

  async function preview() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/import-jinys-stores');
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'preview 실패');
        return;
      }
      setDryRun(j);
      setStep('preview');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!confirm(`${dryRun?.summary.parsed} 개 매장을 import 하고 테스트 매장 3개(ST-0001/0002/0003)를 soft-delete 합니다. 계속할까요?`)) {
      return;
    }
    setLoading(true);
    setStep('importing');
    setError(null);
    try {
      const r = await fetch('/api/admin/import-jinys-stores', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? 'import 실패');
        setStep('preview');
        return;
      }
      setResult(j);
      setStep('done');
      // 페이지 새로고침으로 목록 갱신
      setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setDryRun(null);
    setResult(null);
    setError(null);
    setStep('idle');
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={preview}
        disabled={loading}
        title="지니스안경 홈페이지에서 매장 정보를 일괄 가져옵니다"
      >
        {loading && step === 'idle' ? '확인 중...' : '🏪 지니스 일괄 import'}
      </Button>

      {step !== 'idle' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={close}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'preview' && dryRun && (
              <>
                <h2 className="text-lg font-bold text-gray-900">지니스 매장 import 미리보기</h2>
                <p className="mt-1 text-sm text-gray-500">
                  스크랩 페이지 {dryRun.summary.pages}개에서 {dryRun.summary.parsed}개 매장 추출
                  {dryRun.summary.errors > 0 && (
                    <span className="ml-2 text-amber-600">에러 {dryRun.summary.errors}건</span>
                  )}
                </p>

                {dryRun.errors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <div className="font-medium">Fetch 에러:</div>
                    <ul className="mt-1 space-y-0.5">
                      {dryRun.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>· {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">지역</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">매장명</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">주소</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">전화</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dryRun.sample.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-500">{s.region}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-900">{s.name}</td>
                          <td className="px-3 py-1.5 text-gray-700">{s.address}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-600">{s.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dryRun.summary.parsed > dryRun.sample.length && (
                    <div className="bg-gray-50 px-3 py-1.5 text-center text-[11px] text-gray-500">
                      외 {dryRun.summary.parsed - dryRun.sample.length}개 더
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  <p>실제 import 시 진행됩니다:</p>
                  <ul className="ml-4 mt-1 list-disc">
                    <li>테스트 매장 (ST-0001, ST-0002, ST-0003) soft-delete</li>
                    <li>지니스 매장 J001~ 코드로 upsert (이미 있으면 갱신)</li>
                    <li>좌표 (lat/lng) 는 별도 작업으로 미루어둠</li>
                  </ul>
                </div>

                {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={close} disabled={loading}>
                    취소
                  </Button>
                  <Button onClick={apply} disabled={loading || dryRun.summary.parsed === 0}>
                    {loading ? '저장 중...' : `${dryRun.summary.parsed}개 import 실행`}
                  </Button>
                </div>
              </>
            )}

            {step === 'importing' && (
              <div className="py-12 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                <p className="mt-4 text-sm font-medium text-gray-700">매장 import 중...</p>
                <p className="mt-1 text-xs text-gray-400">DB 업데이트 + 테스트 매장 정리</p>
              </div>
            )}

            {step === 'done' && result && (
              <>
                <h2 className="text-lg font-bold text-emerald-700">✓ import 완료</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="신규 등록" value={`${result.summary.inserted}개`} />
                  <Row label="업데이트" value={`${result.summary.updated}개`} />
                  <Row label="테스트 매장 삭제" value={result.summary.testDeleted.join(', ')} />
                  <Row label="활성 매장 총합" value={`${result.summary.activeStoresAfter}개`} />
                </dl>
                {result.writeErrors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <div className="font-medium">쓰기 에러 {result.writeErrors.length}건:</div>
                    <ul className="mt-1 space-y-0.5">
                      {result.writeErrors.slice(0, 5).map((e, i) => (
                        <li key={i}>· {e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-5 flex justify-end">
                  <Button onClick={close}>닫기</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 pb-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
