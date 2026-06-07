import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// 인스턴스당 동시 요청을 처리할 만큼은 확보해야 한다(너무 작으면 큐잉→타임아웃→500).
// 풀러 한도 문제의 근본 해결은 DATABASE_URL 트랜잭션모드(:6543) 전환.
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 20);

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__pgClient ??
  postgres(connectionString, {
    max: poolMax,
    prepare: false,
    idle_timeout: 20, // 유휴 연결 20s 후 반환 (풀러 점유 최소화)
    max_lifetime: 60 * 30, // 연결 30분마다 재생성
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
