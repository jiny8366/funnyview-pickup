import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { homeSections, type HomeSection } from '@/db/schema';
import { withDbRetry } from '@/lib/db/retry';
import { type CurationMode, curateLenses } from './curation';

export interface HydratedSection extends HomeSection {
  lenses?: Awaited<ReturnType<typeof curateLenses>>;
}

/**
 * 현재 시각 기준 활성 섹션을 정렬 순으로 반환.
 * product_grid 는 큐레이션 결과로 hydrate.
 */
export async function loadActiveSections(): Promise<HydratedSection[]> {
  const now = new Date();
  // 연결 블립 시 빈 화면(섹션 사라짐)으로 떨어지지 않도록 짧게 재시도 — 매 방문 화면 일관성 확보.
  const rows = await withDbRetry(() =>
    db
      .select()
      .from(homeSections)
      .where(
        and(
          eq(homeSections.isActive, true),
          isNull(homeSections.deletedAt),
          or(isNull(homeSections.startsAt), lte(homeSections.startsAt, now)),
          or(isNull(homeSections.endsAt), gte(homeSections.endsAt, now)),
        ),
      )
      .orderBy(asc(homeSections.sortOrder), asc(homeSections.createdAt)),
  );

  return Promise.all(
    rows.map(async (s): Promise<HydratedSection> => {
      if (s.kind !== 'product_grid') return s;
      const cfg = s.config as {
        mode?: CurationMode;
        lensIds?: string[];
        limit?: number;
      };
      // 한 그리드의 큐레이션 실패가 전체 섹션을 무너뜨리지 않도록 재시도 후 빈 배열로 폴백.
      const lenses = await withDbRetry(() =>
        curateLenses(cfg.mode ?? 'best', cfg.limit ?? 4, cfg.lensIds ?? []),
      ).catch(() => []);
      return { ...s, lenses };
    }),
  );
}
