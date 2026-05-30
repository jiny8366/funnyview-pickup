import { put } from '@vercel/blob';
import type { StorageAdapter, UploadResult } from './types';

/**
 * Vercel Blob 어댑터 (프로덕션 권장).
 *
 * 필요: BLOB_READ_WRITE_TOKEN — Vercel 대시보드 Storage → Blob Store 연결 시 자동 주입.
 * 파일 URL: https://<store-id>.public.blob.vercel-storage.com/<key>
 */

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'bin';
  }
}

export const vercelBlobStorage: StorageAdapter = {
  name: 'vercel-blob',

  async upload({
    bytes,
    mimeType,
    folder,
  }: Parameters<StorageAdapter['upload']>[0]): Promise<UploadResult> {
    const ext = extFromMime(mimeType);
    const subdir = folder ?? 'misc';
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `${subdir}/${ts}-${rand}.${ext}`;
    const result = await put(key, bytes, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return {
      url: result.url,
      key,
      size: bytes.length,
      mimeType,
    };
  },

  async delete(_key: string) {
    // 안전을 위해 명시적 삭제는 미구현 — 운영 정책 정해진 뒤 활성화.
  },
};
