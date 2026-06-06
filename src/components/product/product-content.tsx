import { parseBlocks, toEmbedUrl, type ContentBlock } from '@/lib/content/blocks';

/**
 * 제품 상세 콘텐츠(판매정보) 블록 렌더러 — 고객 상세페이지용 읽기전용.
 * description 에 저장된 ContentBlock[] (JSON) 을 파싱해 출력.
 */
export function ProductContent({ description }: { description?: string | null }) {
  const blocks = parseBlocks(description);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-10 border-t border-gray-100 pt-6">
      <h2 className="text-sm font-bold text-gray-900">상세 정보</h2>
      <div className="mt-4 space-y-4">
        {blocks.map((b) => (
          <Block key={b.id} b={b} />
        ))}
      </div>
    </div>
  );
}

function Block({ b }: { b: ContentBlock }) {
  switch (b.type) {
    case 'heading':
      return b.level === 2 ? (
        <h3 className="text-base font-bold text-gray-900">{b.text}</h3>
      ) : (
        <h4 className="text-sm font-semibold text-gray-800">{b.text}</h4>
      );
    case 'paragraph':
      return <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{b.text}</p>;
    case 'list':
      return b.ordered ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'image':
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.alt ?? b.caption ?? ''} className="w-full rounded-xl" loading="lazy" />
          {b.caption && <figcaption className="mt-1 text-center text-xs text-gray-400">{b.caption}</figcaption>}
        </figure>
      );
    case 'gallery':
      return (
        <div className="grid grid-cols-2 gap-2">
          {b.images.map((img, i) => (
            <figure key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ''} className="w-full rounded-lg" loading="lazy" />
              {img.caption && <figcaption className="mt-1 text-center text-xs text-gray-400">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    case 'video':
      return (
        <figure>
          <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={toEmbedUrl(b.url)}
              title={b.caption ?? 'video'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {b.caption && <figcaption className="mt-1 text-center text-xs text-gray-400">{b.caption}</figcaption>}
        </figure>
      );
    case 'divider':
      return <hr className="border-gray-100" />;
    default:
      return null;
  }
}
