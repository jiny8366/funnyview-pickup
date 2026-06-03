/**
 * 일시적 DB 연결 오류(배포 중 Supabase pooler 블립 등)에 대한 짧은 재시도.
 * 쿼터 초과(XX000)·제약위반 등 영구 오류는 재시도하지 않고 즉시 throw.
 */
const TRANSIENT_CODES = new Set([
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECT_TIMEOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08003', // connection_does_not_exist
]);

function isTransient(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (e?.code && TRANSIENT_CODES.has(e.code)) return true;
  return /connection (closed|terminated|reset)|connect timeout|ECONNRESET|cannot connect/i.test(
    String(e?.message ?? ''),
  );
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 200): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransient(err)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
