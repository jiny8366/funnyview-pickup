'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * 제품 가격 일괄 관리 — 브랜드별 CSV(엑셀) 다운로드 → 수정 → 업로드 반영.
 * 다운로드 파일에는 상품 DB 의 모든 값이 포함되며, 업로드 시 productCode 기준으로 반영된다.
 */
export function ProductExcelTools({ brandOptions }: { brandOptions: string[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const q = brand ? `?brand=${encodeURIComponent(brand)}` : '';
    window.location.href = `/api/admin/products/export${q}`;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'content-type': 'text/csv' },
        body: text,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? '업로드에 실패했습니다.');
      } else {
        setMsg(
          `반영 ${j.updated}개 · 가격 변경 ${j.priceChanged}건` +
            (j.failed ? ` · 실패 ${j.failed}건` : ''),
        );
        router.refresh();
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">가격 일괄 관리 (엑셀)</span>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">전체 브랜드</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={download}>
          엑셀 다운로드
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? '업로드 중...' : '엑셀 업로드'}
        </Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        다운로드 → 엑셀에서 가격 수정 → 업로드. productCode 기준으로 매칭하며, 빈 칸은 기존 값을 유지합니다.
        가격(매입·공급·소비자가) 변경은 가격 이력에 함께 기록됩니다.
      </p>
    </div>
  );
}
