'use client';

import { useEffect, useRef, useState } from 'react';
import { videoEmbedSrc } from '@/lib/content/blocks';

export function ImagePicker({
  value,
  onChange,
  folder,
  thumbnailSize,
  enableZoom,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  /** 정사각형 썸네일 변 길이 (px). 미지정 시 기존 동작 (h-32 w-full). */
  thumbnailSize?: number;
  /** true 면 썸네일 클릭 시 확대/축소 모달 표시. */
  enableZoom?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    if (folder) fd.set('folder', folder);
    try {
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'UPLOAD_FAILED');
        return;
      }
      const j = await res.json();
      onChange(j.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const isSquare = typeof thumbnailSize === 'number' && thumbnailSize > 0;
  const thumbStyle = isSquare
    ? { width: thumbnailSize, height: thumbnailSize }
    : undefined;
  // 관리자 호스트는 /products/* 등 고객 정적경로를 로그인으로 리다이렉트(307)하므로,
  // 상대경로 이미지는 고객 호스트 절대 URL 로 변환해 미리보기한다.
  const display =
    value && value.startsWith('/')
      ? `https://funnyview-pickup.vercel.app${value}`
      : value;
  // YouTube/Vimeo 링크를 넣으면 깨진 이미지 대신 영상 미리보기(반복재생)를 보여준다.
  const videoPreview = videoEmbedSrc(value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… 또는 /uploads/…"
          className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? '업로드 중...' : '📁 파일'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={onPick}
      />
      {error && <p className="text-xs text-red-600">{errorLabel(error)}</p>}
      {value && videoPreview && (
        <div className="space-y-1">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-black">
            <iframe
              src={videoPreview}
              title="영상 미리보기"
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-xs text-gray-500">🎬 영상 링크 — 홈에서 반복재생됩니다</p>
        </div>
      )}
      {value && !videoPreview && (
        <button
          type="button"
          onClick={() => enableZoom && setZoomOpen(true)}
          disabled={!enableZoom}
          className={`block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${
            enableZoom ? 'cursor-zoom-in hover:border-brand-300' : 'cursor-default'
          }`}
          style={thumbStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={display}
            alt=""
            className={isSquare ? 'h-full w-full object-cover' : 'h-32 w-full object-cover'}
          />
        </button>
      )}
      {enableZoom && zoomOpen && value && (
        <ZoomModal src={display} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}

function ZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 5));
      if (e.key === '-') setScale((s) => Math.max(s - 0.25, 0.25));
      if (e.key === '0') setScale(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.25, Math.min(5, s + delta)));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4"
    >
      <div className="flex shrink-0 items-center justify-between pb-3 text-white">
        <span className="text-sm">배율: {Math.round(scale * 100)}%</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.25, s - 0.25)); }}
            className="h-9 w-9 rounded-lg border border-white/30 bg-white/10 text-lg hover:bg-white/20"
            title="축소 (-)"
          >
            −
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale(1); }}
            className="h-9 rounded-lg border border-white/30 bg-white/10 px-3 text-xs hover:bg-white/20"
            title="원본 (0)"
          >
            100%
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(5, s + 0.25)); }}
            className="h-9 w-9 rounded-lg border border-white/30 bg-white/10 text-lg hover:bg-white/20"
            title="확대 (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-white/30 bg-white/10 px-3 text-sm hover:bg-white/20"
          >
            닫기 ✕
          </button>
        </div>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        className="flex flex-1 items-center justify-center overflow-auto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          className="max-h-full max-w-full transition-transform"
        />
      </div>
    </div>
  );
}

function errorLabel(code: string): string {
  switch (code) {
    case 'FILE_TOO_LARGE':
      return '파일이 5MB 를 초과합니다';
    case 'UNSUPPORTED_TYPE':
      return '지원하지 않는 형식 (png/jpg/webp/gif/svg)';
    case 'FORBIDDEN':
      return '권한 없음';
    case 'STORAGE_FAILED':
      return '저장소 업로드 실패 — Vercel Blob 토큰 또는 storage 설정 확인';
    default:
      return code;
  }
}
