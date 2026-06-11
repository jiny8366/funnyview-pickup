'use client';

import { useState } from 'react';

/**
 * 제품 미디어 렌더러 — 발주/카탈로그 카드의 이미지/영상 표시.
 *
 * 기본: 이미지 (imageUrl ?? /api/lens-image/{productCode}, onError 시 폴백 라우트).
 * videoUrl 이 있으면 이미지 위에 작은 원형 ▶ 버튼을 띄우고, 클릭 시 인라인 재생.
 *   - YouTube/Vimeo URL → lazy <iframe> embed (클릭 시점에만 로드, autoplay).
 *   - self-hosted(.mp4/.webm 또는 /uploads·/products 경로) → <video controls autoPlay muted playsInline>.
 *
 * 성능: 영상은 클릭 시 단 하나만 로드(컴포넌트별 state). 절대 전부 autoload 하지 않는다.
 * 다크세이프: dark: variant 없음, opacity-suffixed bg 없음.
 */

interface ProductMediaProps {
  imageUrl: string | null;
  videoUrl?: string | null;
  productCode: string;
  name: string;
  className?: string;
  rounded?: boolean;
}

type VideoKind = { kind: 'youtube'; embed: string } | { kind: 'vimeo'; embed: string } | { kind: 'file'; src: string } | null;

/** videoUrl 을 분류하고 재생용 정보를 만든다. 인식 불가하면 null. */
function classifyVideo(raw: string | null | undefined): VideoKind {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // 절대 URL 만 host 파싱. 상대 경로(/uploads, /products)는 file 로 처리.
  let host = '';
  if (/^https?:\/\//i.test(url)) {
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      host = '';
    }
  }

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
    const id = extractYouTubeId(url);
    if (id) {
      return { kind: 'youtube', embed: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` };
    }
  }

  // Vimeo
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
    const id = extractVimeoId(url);
    if (id) {
      return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${id}?autoplay=1` };
    }
  }

  // self-hosted: 확장자 또는 알려진 경로
  if (/\.(mp4|webm)(\?|#|$)/i.test(url) || /^\/?(uploads|products)\//i.test(url) || url.startsWith('/')) {
    return { kind: 'file', src: url };
  }

  // 그 외 절대 URL 도 마지막엔 file 로 시도 (직접 링크 mp4 등)
  if (/^https?:\/\//i.test(url)) {
    return { kind: 'file', src: url };
  }

  return null;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    // /embed/{id} or /shorts/{id}
    const m = u.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/);
    if (m) return m[1];
  } catch {
    /* noop */
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/(\d+)/);
    if (m) return m[1];
  } catch {
    /* noop */
  }
  return null;
}

export function ProductMedia({
  imageUrl,
  videoUrl,
  productCode,
  name,
  className,
  rounded,
}: ProductMediaProps) {
  const [playing, setPlaying] = useState(false);
  const fallback = `/api/lens-image/${productCode}`;
  const imageSrc = imageUrl ?? fallback;
  const video = classifyVideo(videoUrl);
  const radius = rounded ? 'rounded-lg' : '';

  if (playing && video) {
    return (
      <div className={`relative h-full w-full overflow-hidden bg-black ${radius} ${className ?? ''}`}>
        {video.kind === 'file' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={video.src}
            controls
            autoPlay
            muted
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <iframe
            src={video.embed}
            title={name}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        )}
        <button
          type="button"
          onClick={() => setPlaying(false)}
          aria-label="영상 닫기"
          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black text-xs text-white hover:bg-gray-700"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={name}
        className={`h-full w-full object-contain ${radius}`}
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget;
          if (el.dataset.fb) return;
          el.dataset.fb = '1';
          el.src = fallback;
        }}
      />
      {video && (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="영상 재생"
          title="영상 재생"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-black text-white shadow-lg ring-2 ring-white transition hover:bg-gray-800">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
