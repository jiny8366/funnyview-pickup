'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBox, IconClose, IconPlus, IconSearch } from '@/components/ui/icons';

interface LookupResult {
  parsed: {
    raw: string;
    di: string | null;
    format: string;
    pi?: { lot?: string; expiry?: string };
    notes?: string[];
  };
  match: {
    variant: {
      id: string;
      sku: string;
      sphere: string | null;
      cylinder: string | null;
      axis: number | null;
      addPower: string | null;
    };
    lens: {
      id: string;
      brand: string;
      name: string;
      replacementCycle: string;
      piecesPerBox: number;
      lensType: string;
    };
    displayName: string;
    inventory: { quantityOnHand: number } | null;
  } | null;
}

interface InboundLog {
  id: string;
  displayName: string;
  quantity: number;
  at: string;
  newOnHand: number;
}

export default function WarehouseInboundPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [continuous, setContinuous] = useState(true);
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState<InboundLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  const lookup = useCallback(async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/warehouse/inbound/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: text }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? '조회 실패');
        return;
      }
      setResult(j);
      setQuantity(1);
    } finally {
      setBusy(false);
    }
  }, []);

  function onSubmitScan(e: React.FormEvent) {
    e.preventDefault();
    if (!raw.trim()) return;
    lookup(raw);
  }

  async function commit() {
    if (!result?.match) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/warehouse/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variantId: result.match.variant.id,
          quantity,
          note: note || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? '입고 실패');
        return;
      }
      setLogs((p) => [
        {
          id: j.movement.id,
          displayName: result.match!.displayName,
          quantity,
          at: new Date().toLocaleTimeString('ko-KR'),
          newOnHand: j.inventory.quantityOnHand,
        },
        ...p,
      ]);
      // 다음 스캔 준비
      setRaw('');
      setResult(null);
      setQuantity(1);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setRaw('');
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">입고 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            바코드(1D EAN-13 / 2D GS1 DataMatrix) 스캔 또는 키보드 입력 후 Enter.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={continuous}
            onChange={(e) => setContinuous(e.target.checked)}
            className="h-4 w-4"
          />
          연속 스캔 모드
        </label>
      </header>

      {/* 스캔 입력 */}
      <Card>
        <CardBody>
          <form onSubmit={onSubmitScan} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={inputRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="바코드 스캔 또는 입력 (예: 8809123456789)"
                className="h-12 w-full rounded-lg border-2 border-brand-200 bg-white pl-10 pr-3 text-base font-mono text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Button type="submit" size="lg" disabled={!raw || busy}>
              {busy ? '조회 중...' : '조회'}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">⚠️ {error}</p>}
        </CardBody>
      </Card>

      {/* 매칭 결과 */}
      {result && <MatchPanel result={result} quantity={quantity} setQuantity={setQuantity} note={note} setNote={setNote} onCommit={commit} onCancel={cancel} busy={busy} />}

      {/* 이번 세션 입고 큐 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>이번 세션 입고 ({logs.length})</CardTitle>
            <CardDescription>오늘 처리된 입고 — 새로고침 시 초기화 (감사로그는 영구 보관)</CardDescription>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              화면 초기화
            </button>
          )}
        </CardHeader>
        <CardBody>
          {logs.length === 0 ? (
            <EmptyState
              icon={<IconBox size={28} />}
              title="아직 입고가 없습니다"
              description="위 입력 박스에 바코드를 스캔하거나 13자리 EAN-13 을 입력하세요."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">{l.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {l.at} · 재고 {l.newOnHand}팩
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    +{l.quantity}팩
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function MatchPanel({
  result,
  quantity,
  setQuantity,
  note,
  setNote,
  onCommit,
  onCancel,
  busy,
}: {
  result: LookupResult;
  quantity: number;
  setQuantity: (n: number) => void;
  note: string;
  setNote: (s: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { parsed, match } = result;

  if (!match) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                ⚠️ 매칭되는 SKU 가 없습니다
              </div>
              <dl className="mt-2 space-y-1 text-xs text-amber-800">
                <div className="flex gap-2">
                  <dt className="w-16 font-medium">스캔값</dt>
                  <dd className="font-mono">{parsed.raw}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 font-medium">DI</dt>
                  <dd className="font-mono">{parsed.di ?? '추출 실패'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 font-medium">형식</dt>
                  <dd>{parsed.format}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-amber-700">
                대응 방법:
                <br />
                · 식약처 UDI 일괄 갱신 (관리자 → UDI 새로고침)
                <br />
                · 또는 관리자가 직접 제품 등록 + 바코드 매핑
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="grid h-8 w-8 place-items-center rounded text-amber-600 hover:bg-amber-100"
              aria-label="닫기"
            >
              <IconClose size={16} />
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const onHand = match.inventory?.quantityOnHand ?? 0;

  return (
    <Card className="border-brand-200">
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-brand-600">✅ 매칭됨</div>
            <div className="mt-1 text-base font-semibold text-gray-900">
              {match.displayName}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 md:grid-cols-3">
              <div>
                <dt className="text-gray-400">SKU</dt>
                <dd className="font-mono">{match.variant.sku}</dd>
              </div>
              <div>
                <dt className="text-gray-400">현재 재고</dt>
                <dd className="font-semibold text-gray-900">{onHand}팩</dd>
              </div>
              <div>
                <dt className="text-gray-400">바코드</dt>
                <dd className="font-mono">{parsed.di} · {parsed.format}</dd>
              </div>
              {parsed.pi?.expiry && (
                <div>
                  <dt className="text-gray-400">유효기간 (참고)</dt>
                  <dd>{parsed.pi.expiry}</dd>
                </div>
              )}
              {parsed.pi?.lot && (
                <div>
                  <dt className="text-gray-400">로트 (참고)</dt>
                  <dd className="font-mono">{parsed.pi.lot}</dd>
                </div>
              )}
            </dl>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded text-gray-400 hover:bg-gray-100"
            aria-label="취소"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              입고 수량 (팩)
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 bg-white">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-10 w-10 text-gray-500 hover:bg-gray-50"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-12 border-0 bg-transparent text-center font-mono text-base focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="h-10 w-10 text-gray-500 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">메모 (선택)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="공급사·전표번호 등"
              className="input"
            />
          </div>

          <div className="flex items-end">
            <Button onClick={onCommit} disabled={busy} className="w-full gap-1.5 sm:w-auto">
              <IconPlus size={16} />
              {busy ? '입고 중...' : `+${quantity}팩 입고`}
            </Button>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          입고 후 재고: <span className="font-semibold text-gray-900">{onHand} → {onHand + quantity}팩</span>
          {match.lens.piecesPerBox > 0 && (
            <span className="ml-2 text-gray-400">
              = {((onHand + quantity) * match.lens.piecesPerBox).toLocaleString()}매
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
