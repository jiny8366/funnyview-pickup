import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { businessInfo, type BusinessInfo } from '@/db/schema';
import { withDbRetry } from '@/lib/db/retry';

/**
 * 사업장(발행자) 정보 singleton(id=1) 조회 — 공개 푸터/약관/명세서 표기의 단일 출처.
 * admin 전용 GET API(/api/admin/business-info)와 달리 권한 없이 서버에서 직접 읽어
 * 고객 푸터의 법정 사업자표기(전자상거래법 의무)에 사용한다.
 * 행이 없거나 연결 블립이면 null 폴백(푸터는 안전한 기본 문구로 렌더).
 */
export async function loadBusinessInfo(): Promise<BusinessInfo | null> {
  return withDbRetry(() =>
    db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.id, 1))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ).catch(() => null);
}
