/**
 * 홈 고객 리뷰 섹션 (방안B — lenslink 스타일).
 * ⚠️ 현재 리뷰 데이터 모델이 없어 정적 샘플로 구성. 추후 reviews 테이블 도입 시
 * 실데이터로 교체 예정. 디자인 디테일은 M1 #3 패스에서 보강.
 */
const REVIEWS: { name: string; product: string; rating: number; body: string }[] = [
  { name: '김*은', product: '아큐브 오아시스 원데이', rating: 5, body: '눈이 건조했는데 하루 종일 촉촉해요. 매장 픽업도 편했어요!' },
  { name: '이*아', product: '클라렌 아이리스 컬러', rating: 5, body: '발색 자연스럽고 착용감 좋아요. 안경사 상담받고 사니 안심돼요.' },
  { name: '박*호', product: '바슈롬 울트라 원데이', rating: 4, body: '난시용인데 시야 또렷합니다. 가까운 안경원에서 받아 빠르고 좋아요.' },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400" aria-label={`별점 ${n}점`}>
      {'★'.repeat(n)}
      <span className="text-gray-200">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export function ReviewSection() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-tight text-gray-900 md:text-xl">고객 리뷰</h2>
        <p className="mt-0.5 text-xs text-gray-400">픽업 고객들의 생생한 후기</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {REVIEWS.map((r, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
            <Stars n={r.rating} />
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{r.body}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span className="font-medium text-gray-600">{r.name}</span>
              <span className="truncate pl-2">{r.product}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
