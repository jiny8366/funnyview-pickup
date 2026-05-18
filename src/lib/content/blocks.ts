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
