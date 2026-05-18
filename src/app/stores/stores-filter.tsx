'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IconSearch } from '@/components/ui/icons';

export function StoresFilter({
  regions,
  initialRegion,
  initialQ,
}: {
  regions: string[];
  initialRegion: string;
  initialQ: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);

  function apply(next: { region?: string; q?: string }) {
    const sp = new URLSearchParams(params?.toString() ?? '');
    if (next.region !== undefined) {
      if (next.region) sp.set('region', next.region);
      else sp.delete('region');
    }
    if (next.q !== undefined) {
      if (next.q) sp.set('q', next.q);
      else sp.delete('q');
    }
    router.replace(`/stores?${sp.toString()}`);
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
      >
        <IconSearch size={18} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="매장명 또는 주소로 검색"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              apply({ q: '' });
            }}
            className="text-xs text-gray-400 hover:text-gray-900"
          >
            ✕
          </button>
        )}
      </form>

      <div className="flex flex-wrap gap-1.5">
        <Chip
          active={!initialRegion}
          onClick={() => apply({ region: '' })}
          label="전체"
        />
        {regions.map((r) => (
          <Chip
            key={r}
            active={initialRegion === r}
            onClick={() => apply({ region: r })}
            label={r}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
          : 'rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  );
}
