'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, PageWrap } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBox, IconEdit, IconPlus, IconSearch } from '@/components/ui/icons';
import { SkeletonCard } from '@/components/ui/skeleton';

interface LensRow {
  id: string;
  productCode: string;
  brand: string;
  name: string;
  lensType: string;
  replacementCycle: string;
  piecesPerBox: number;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
}

const LENS_TYPE_LABEL: Record<string, string> = {
  spherical: '일반',
  toric: '난시',
  multifocal: '다초점',
  color: '컬러',
  circle: '써클',
};

const CYCLE_LABEL: Record<string, string> = {
  '1day': '원데이',
  '2week': '2주',
  '1month': '1개월',
  '3month': '3개월',
  '6month': '6개월',
  '1year': '1년',
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<LensRow[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/admin/lenses', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setItems(j.lenses ?? []));
  }, []);

  const filtered =
    items?.filter(
      (it) =>
        !q ||
        it.brand.toLowerCase().includes(q.toLowerCase()) ||
        it.name.toLowerCase().includes(q.toLowerCase()) ||
        it.productCode.toLowerCase().includes(q.toLowerCase()),
    ) ?? null;

  return (
    <PageWrap>
      <PageHeader
        title="제품 마스터"
        description="콘택트렌즈 제품군을 등록하고 관리합니다. 도수별 SKU 는 제품별 상세에서 관리합니다."
        actions={
          <Link href="/admin/products/new">
            <Button className="gap-1.5">
              <IconPlus size={16} />
              새 제품 등록
            </Button>
          </Link>
        }
      />

      {/* 검색바 */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
        <IconSearch size={18} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="브랜드, 제품명, 코드로 검색"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        {items && (
          <span className="text-xs text-gray-500">
            {filtered?.length ?? 0} / {items.length}
          </span>
        )}
      </div>

      {/* 본문 */}
      {items === null ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconBox size={28} />}
          title="아직 등록된 제품이 없습니다"
          description="첫 콘택트렌즈 제품을 등록해보세요. 이미지·영상·설명을 풍부하게 구성할 수 있는 편집기를 제공합니다."
          action={
            <Link href="/admin/products/new">
              <Button className="gap-1.5">
                <IconPlus size={16} />첫 제품 등록하기
              </Button>
            </Link>
          }
        />
      ) : filtered && filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={28} />}
          title="검색 결과가 없습니다"
          description={`"${q}" 와 일치하는 제품이 없습니다.`}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((it) => (
            <ProductCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </PageWrap>
  );
}

function ProductCard({ item }: { item: LensRow }) {
  return (
    <Link
      href={`/admin/products/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-50">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-gray-300">
            <IconBox size={36} />
          </div>
        )}
        {!item.isActive && (
          <span className="absolute left-2 top-2 rounded bg-gray-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
            비활성
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
            {item.brand}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            {LENS_TYPE_LABEL[item.lensType] ?? item.lensType}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            {CYCLE_LABEL[item.replacementCycle] ?? item.replacementCycle}
          </span>
        </div>
        <div className="text-sm font-semibold text-gray-900">{item.name}</div>
        <div className="text-[11px] text-gray-500">코드: {item.productCode} · {item.piecesPerBox}매입</div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="text-base font-bold text-gray-900">
            ₩{item.price.toLocaleString()}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 group-hover:text-brand-600">
            <IconEdit size={12} /> 편집
          </span>
        </div>
      </div>
    </Link>
  );
}
