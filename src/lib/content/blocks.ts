export type ContentBlock =
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image'; url: string; caption?: string; alt?: string }
  | { id: string; type: 'video'; url: string; caption?: string }
  | {
      id: string;
      type: 'gallery';
      images: { url: string; caption?: string }[];
    }
  | { id: string; type: 'list'; items: string[]; ordered?: boolean }
  | { id: string; type: 'divider' };

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function parseBlocks(raw: string | null | undefined): ContentBlock[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((b: unknown) => isValidBlock(b)) as ContentBlock[];
    }
  } catch {
    // legacy plain-text description
  }
  return [
    {
      id: newBlockId(),
      type: 'paragraph',
      text: trimmed,
    },
  ];
}

function isValidBlock(b: unknown): boolean {
  if (!b || typeof b !== 'object') return false;
  const t = (b as { type?: unknown }).type;
  return (
    typeof t === 'string' &&
    ['heading', 'paragraph', 'image', 'video', 'gallery', 'list', 'divider'].includes(t)
  );
}

export function serializeBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks);
}

/**
 * YouTube / Vimeo URL을 embed URL 로 변환.
 * 변환 불가 시 원본 반환.
 */
export function toEmbedUrl(raw: string): string {
  const url = raw.trim();
  // YouTube
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

/**
 * 이미지 필드에 들어온 값이 YouTube/Vimeo 영상이면 임베드 src 반환, 아니면 null.
 * 기본: 자동재생·음소거(자동재생 정책)·반복재생.
 */
export function videoEmbedSrc(
  raw: string | null | undefined,
  opts: { loop?: boolean; autoplay?: boolean; mute?: boolean; controls?: boolean } = {},
): string | null {
  if (!raw) return null;
  const url = raw.trim();
  const { loop = true, autoplay = true, mute = true, controls = false } = opts;

  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) {
    const id = yt[1];
    const p = new URLSearchParams();
    if (autoplay) p.set('autoplay', '1');
    if (mute) p.set('mute', '1');
    if (loop) {
      p.set('loop', '1');
      p.set('playlist', id); // loop 동작에 필수(같은 영상 반복)
    }
    if (!controls) {
      p.set('controls', '0'); // 컨트롤바 숨김
      p.set('disablekb', '1'); // 키보드 컨트롤 비활성
      p.set('modestbranding', '1'); // 로고 최소화
      p.set('iv_load_policy', '3'); // 주석(annotation) 숨김
    }
    p.set('playsinline', '1');
    p.set('rel', '0');
    return `https://www.youtube.com/embed/${id}?${p.toString()}`;
  }

  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) {
    const p = new URLSearchParams();
    // Vimeo 는 background 모드가 컨트롤·UI 전부 숨기고 자동재생·무음·반복까지 처리
    if (!controls && autoplay && mute && loop) {
      p.set('background', '1');
    } else {
      if (autoplay) p.set('autoplay', '1');
      if (mute) p.set('muted', '1');
      if (loop) p.set('loop', '1');
      if (!controls) p.set('controls', '0');
    }
    return `https://player.vimeo.com/video/${vm[1]}?${p.toString()}`;
  }

  return null;
}
