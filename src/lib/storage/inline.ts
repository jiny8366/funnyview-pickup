import type { StorageAdapter, UploadResult } from './types';

/**
 * 인라인 base64 어댑터 — 외부 storage 가 설정되지 않았을 때 fallback.
 *
 * 파일을 data URL 로 인코딩하여 DB(text 컬럼)에 직접 저장.
 * 장점: 외부 인프라/env 불필요 — Vercel Blob 토큰 발급 전에도 즉시 동작.
 * 단점: 원본 바이트의 ~1.37배 (base64) 가 DB 에 적재되므로 다수 제품 카드를 동시에
 *       내려주는 catalog 응답이 무거워짐. 운영 권장: Vercel Blob 으로 전환.
 */

export const inlineStorage: StorageAdapter = {
  name: 'inline',

  async upload({
    bytes,
    mimeType,
  }: Parameters<StorageAdapter['upload']>[0]): Promise<UploadResult> {
    const b64 = bytes.toString('base64');
    const url = `data:${mimeType};base64,${b64}`;
    return {
      url,
      key: '',
      size: bytes.length,
      mimeType,
    };
  },

  async delete(_key: string) {
    // data URL 은 별도 저장소가 없어 삭제 동작 없음.
  },
};
