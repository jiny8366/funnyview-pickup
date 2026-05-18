/**
 * 다른 portal 의 절대 URL 생성.
 *
 * 호스트 변환 규칙 (자동):
 *   funnyview-pickup.vercel.app    → {prefix}-funnyview-pickup.vercel.app
 *   funnyview.kr                   → {prefix}.funnyview.kr
 *   localhost:3001                 → localhost:3001 (개발 시 동일 호스트)
 *
 * 환경변수 override:
 *   NEXT_PUBLIC_HOST_ADMIN / _STAFF / _STORE 가 설정되어 있으면 그 host 사용.
 */

export type PortalKind = 'admin' | 'staff' | 'store' | 'customer';

const ENV_HOSTS: Record<Exclude<PortalKind, 'customer'>, string | undefined> = {
  admin: process.env.NEXT_PUBLIC_HOST_ADMIN,
  staff: process.env.NEXT_PUBLIC_HOST_STAFF,
  store: process.env.NEXT_PUBLIC_HOST_STORE,
};

export function portalUrl(kind: PortalKind, path: string = '/'): string {
  if (typeof window === 'undefined') return path; // SSR fallback

  const proto = window.location.protocol;
  const currentHost = window.location.host;

  // customer 는 prefix 없는 메인 호스트
  if (kind === 'customer') {
    const main = currentHost
      .replace(/^admin[-.]/, '')
      .replace(/^staff[-.]/, '')
      .replace(/^store[-.]/, '');
    return `${proto}//${main}${path}`;
  }

  // ENV override
  const envHost = ENV_HOSTS[kind];
  if (envHost) return `${proto}//${envHost}${path}`;

  // localhost / 개발 환경 — 같은 host 유지
  if (currentHost.startsWith('localhost') || currentHost.startsWith('127.')) {
    return path;
  }

  // 자동 변환 — admin- / staff- / store- prefix 적용
  const baseHost = currentHost
    .replace(/^admin[-.]/, '')
    .replace(/^staff[-.]/, '')
    .replace(/^store[-.]/, '');
  const separator = baseHost.includes('.vercel.app') ? '-' : '.';
  return `${proto}//${kind}${separator}${baseHost}${path}`;
}
