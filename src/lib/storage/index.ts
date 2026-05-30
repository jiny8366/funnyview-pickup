import { inlineStorage } from './inline';
import { localStorage } from './local';
import { vercelBlobStorage } from './vercel-blob';
import type { StorageAdapter } from './types';

/**
 * 환경별 자동 선택:
 * 1) STORAGE_PROVIDER 명시 (local | vercel-blob | inline) → 해당 어댑터
 * 2) BLOB_READ_WRITE_TOKEN 존재 → vercel-blob (Vercel 대시보드 Storage 연결 시 자동)
 * 3) VERCEL 환경 변수 존재 → inline (서버리스 read-only fs 회피)
 * 4) 그 외 → local (개발용 파일시스템 저장)
 */
export function getStorage(): StorageAdapter {
  const explicit = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (explicit === 'local') return localStorage;
  if (explicit === 'vercel-blob') return vercelBlobStorage;
  if (explicit === 'inline') return inlineStorage;

  if (process.env.BLOB_READ_WRITE_TOKEN) return vercelBlobStorage;
  if (process.env.VERCEL) return inlineStorage;
  return localStorage;
}

export type { StorageAdapter, UploadResult } from './types';
