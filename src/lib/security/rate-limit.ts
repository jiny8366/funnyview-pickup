/**
 * 경량 인메모리 rate limiter (로그인/가입 무차별 대입 방어 — go-live 보안).
 *
 * 한계: 서버리스 인스턴스별 독립 카운터(공유 저장소 없음 — prod 에 Redis 미설정).
 * 단일 IP 의 연속 시도는 대개 같은 warm 인스턴스에 떨어지므로 실질 방어선이 되고,
 * 정확한 전역 제한이 필요해지면 Upstash Redis 도입 시 이 모듈만 교체한다.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  // 과도한 메모리 점유 방지 — 1분에 한 번 만료 버킷 제거
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** 차단 시 재시도까지 남은 초 (allowed=true 면 0) */
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Vercel/프록시 환경에서 클라이언트 IP 추출. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
