'use client';

import { useState } from 'react';
import { ImagePicker } from '@/components/admin/image-picker';
import {
  IconClose,
  IconDown,
  IconImage,
  IconLayout,
  IconList,
  IconPlus,
  IconText,
  IconUp,
  IconVideo,
} from '@/components/ui/icons';
import {
  type ContentBlock,
  newBlockId,
  toEmbedUrl,
} from '@/lib/content/blocks';
import { cn } from '@/lib/utils/cn';

export function ProductEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (b: ContentBlock[]) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  function add(type: ContentBlock['type']) {
    const base = { id: newBlockId() };
    let block: ContentBlock;
    switch (type) {
      case 'heading':
        block = { ...base, type, level: 2, text: '' };
        break;
      case 'paragraph':
        block = { ...base, type, text: '' };
        break;
      case 'image':
        block = { ...base, type, url: '', caption: '' };
        break;
      case 'video':
        block = { ...base, type, url: '', caption: '' };
        break;
      case 'gallery':
        block = { ...base, type, images: [] };
        break;
      case 'list':
        block = { ...base, type, items: [''], ordered: false };
        break;
      case 'divider':
        block = { ...base, type };
        break;
    }
    onChange([...blocks, block]);
  }

  function update(id: string, patch: Partial<ContentBlock>) {
    onChange(
      blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)),
    );
  }

  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      {/* 상단 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarBtn label="제목" icon={<IconLayout size={16} />} onClick={() => add('heading')} />
          <ToolbarBtn label="본문" icon={<IconText size={16} />} onClick={() => add('paragraph')} />
          <ToolbarBtn label="이미지" icon={<IconImage size={16} />} onClick={() => add('image')} />
          <ToolbarBtn label="영상" icon={<IconVideo size={16} />} onClick={() => add('video')} />
          <ToolbarBtn label="갤러리" icon={<IconImage size={16} />} onClick={() => add('gallery')} />
          <ToolbarBtn label="목록" icon={<IconList size={16} />} onClick={() => add('list')} />
          <ToolbarBtn label="구분선" icon={<span className="font-mono text-xs">—</span>} onClick={() => add('divider')} />
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {showPreview ? '편집으로' : '👁️ 미리보기'}
        </button>
      </div>

      {showPreview ? (
        <BlockPreview blocks={blocks} />
      ) : (
        <div className="space-y-2">
          {blocks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
              아직 콘텐츠가 없습니다. 위 도구로 블록을 추가하세요.
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Suggest label="📝 본문 추가" onClick={() => add('paragraph')} />
                <Suggest label="🖼️ 이미지 추가" onClick={() => add('image')} />
                <Suggest label="🎬 영상 추가" onClick={() => add('video')} />
              </div>
            </div>
          ) : (
            blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                first={i === 0}
                last={i === blocks.length - 1}
                onChange={(patch) => update(b.id, patch)}
                onRemove={() => remove(b.id)}
                onMove={(d) => move(b.id, d)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
    >
      {icon}
      {label}
    </button>
  );
}

function Suggest({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
    >
      {label}
    </button>
  );
}

function BlockCard({
  block,
  first,
  last,
  onChange,
  onRemove,
  onMove,
}: {
  block: ContentBlock;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
          {BLOCK_LABEL[block.type]}
        </span>
        <div className="flex items-center gap-0.5">
          <IconBtn label="위로" icon={<IconUp size={14} />} disabled={first} onClick={() => onMove(-1)} />
          <IconBtn label="아래로" icon={<IconDown size={14} />} disabled={last} onClick={() => onMove(1)} />
          <IconBtn label="삭제" icon={<IconClose size={14} />} onClick={onRemove} />
        </div>
      </div>
      <BlockEditor block={block} onChange={onChange} />
    </div>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {icon}
    </button>
  );
}

const BLOCK_LABEL: Record<ContentBlock['type'], string> = {
  heading: '제목',
  paragraph: '본문',
  image: '이미지',
  video: '영상',
  gallery: '갤러리',
  list: '목록',
  divider: '구분선',
};

function BlockEditor({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="flex items-center gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ level: Number(e.target.value) as 2 | 3 })}
            className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            type="text"
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="제목을 입력하세요"
            className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm font-semibold"
          />
        </div>
      );
    case 'paragraph':
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          placeholder="본문을 입력하세요. Markdown 일부 (**굵게**, *기울임*) 지원."
          className="block w-full resize-y rounded-lg border border-gray-300 p-3 text-sm leading-relaxed"
        />
      );
    case 'image':
      return (
        <div className="space-y-2">
          <ImagePicker
            value={block.url}
            onChange={(url) => onChange({ url })}
            folder="lenses"
          />
          <input
            type="text"
            value={block.caption ?? ''}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="캡션 (선택)"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
          />
          <input
            type="text"
            value={block.alt ?? ''}
            onChange={(e) => onChange({ alt: e.target.value })}
            placeholder="대체 텍스트 (접근성, 선택)"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
      );
    case 'video':
      return (
        <div className="space-y-2">
          <input
            type="url"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="YouTube 또는 Vimeo URL (예: https://youtu.be/dQw4w9WgXcQ)"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
          />
          <input
            type="text"
            value={block.caption ?? ''}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="캡션 (선택)"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm"
          />
          {block.url && (
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={toEmbedUrl(block.url)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="preview"
              />
            </div>
          )}
        </div>
      );
    case 'gallery':
      return (
        <GalleryEditor
          images={block.images}
          onChange={(images) => onChange({ images })}
        />
      );
    case 'list':
      return (
        <ListEditor
          items={block.items}
          ordered={!!block.ordered}
          onChange={(p) => onChange(p)}
        />
      );
    case 'divider':
      return <div className="my-2 h-px w-full bg-gray-200" />;
  }
}

function GalleryEditor({
  images,
  onChange,
}: {
  images: { url: string; caption?: string }[];
  onChange: (images: { url: string; caption?: string }[]) => void;
}) {
  function update(i: number, patch: { url?: string; caption?: string }) {
    onChange(images.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(images.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...images, { url: '', caption: '' }]);
  }
  return (
    <div className="space-y-3">
      {images.map((img, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              제거
            </button>
          </div>
          <ImagePicker
            value={img.url}
            onChange={(url) => update(i, { url })}
            folder="lenses/gallery"
          />
          <input
            type="text"
            value={img.caption ?? ''}
            onChange={(e) => update(i, { caption: e.target.value })}
            placeholder="캡션"
            className="mt-2 h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <IconPlus size={16} /> 이미지 추가
      </button>
    </div>
  );
}

function ListEditor({
  items,
  ordered,
  onChange,
}: {
  items: string[];
  ordered: boolean;
  onChange: (patch: { items?: string[]; ordered?: boolean }) => void;
}) {
  function update(i: number, val: string) {
    onChange({ items: items.map((it, idx) => (idx === i ? val : it)) });
  }
  function remove(i: number) {
    onChange({ items: items.filter((_, idx) => idx !== i) });
  }
  function add() {
    onChange({ items: [...items, ''] });
  }
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={ordered}
          onChange={(e) => onChange({ ordered: e.target.checked })}
        />
        번호 매기기
      </label>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-xs text-gray-400">{ordered ? `${i + 1}.` : '•'}</span>
          <input
            type="text"
            value={it}
            onChange={(e) => update(i, e.target.value)}
            placeholder="항목"
            className="h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
      >
        <IconPlus size={14} /> 항목 추가
      </button>
    </div>
  );
}

function BlockPreview({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {blocks.length === 0 ? (
        <p className="text-sm text-gray-400">미리보기할 콘텐츠가 없습니다.</p>
      ) : (
        <div className="prose prose-sm max-w-none space-y-4">
          {blocks.map((b) => (
            <RenderedBlock key={b.id} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function RenderedBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': {
      const Tag = (block.level === 2 ? 'h2' : 'h3') as 'h2' | 'h3';
      return (
        <Tag
          className={cn(
            'font-semibold text-gray-900',
            block.level === 2 ? 'text-xl' : 'text-base',
          )}
        >
          {block.text || <em className="text-gray-300">제목</em>}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p
          className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: inlineFormat(block.text || '') }}
        />
      );
    case 'image':
      return (
        <figure>
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={block.alt ?? block.caption ?? ''}
              className="w-full rounded-lg border border-gray-200"
            />
          ) : (
            <div className="grid h-48 place-items-center rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
              이미지 URL 없음
            </div>
          )}
          {block.caption && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case 'video':
      return (
        <figure>
          {block.url ? (
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <iframe
                src={toEmbedUrl(block.url)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="video"
              />
            </div>
          ) : (
            <div className="grid h-48 place-items-center rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
              영상 URL 없음
            </div>
          )}
          {block.caption && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case 'gallery':
      return (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {block.images.length === 0 ? (
            <div className="col-span-full grid h-32 place-items-center rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
              갤러리 이미지 없음
            </div>
          ) : (
            block.images.map((img, i) =>
              img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.url}
                  alt={img.caption ?? ''}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div key={i} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
                  비어있음
                </div>
              ),
            )
          )}
        </div>
      );
    case 'list': {
      const Tag = (block.ordered ? 'ol' : 'ul') as 'ol' | 'ul';
      return (
        <Tag className={cn('space-y-1 pl-5 text-sm text-gray-700', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((it, i) => (
            <li key={i}>{it || <em className="text-gray-300">빈 항목</em>}</li>
          ))}
        </Tag>
      );
    }
    case 'divider':
      return <hr className="my-4 border-gray-200" />;
  }
}
