import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel 서버에서 브랜드 사이트 / 리테일러 / 아카이브에 접근 가능한지 진단.
 * 마스터/관리자만 호출 가능. 결과를 보고 어떤 소스를 자동 스크래핑할지 결정.
 *
 * 사용: GET /api/admin/scrape-test (어드민 로그인 필요)
 */

interface ProbeResult {
  url: string;
  ok: boolean;
  status: number;
  contentType: string | null;
  bytes: number;
  redirected: boolean;
  finalUrl: string;
  error?: string;
  ms: number;
}

const TARGETS = [
  // 브랜드 공식 사이트
  'https://www.acuvue.co.kr/products/acuvue-define-1-day',
  'https://www.bausch.co.kr/our-products/contact-lenses/lacelle',
  'https://www.alcon.co.kr/our-products/vision-care/freshlook',
  'https://www.clalen.com',
  // 한국 리테일러
  'https://klenspop.com/collections/bausch-lomb-lacelle',
  'https://lensaround.com',
  // 글로벌 리테일러
  'https://eyecandys.com/collections/bausch-and-lomb-lacelle',
  // 공개 데이터/검색
  'https://www.google.com/search?q=lacelle+lens&tbm=isch',
  'https://duckduckgo.com/?q=lacelle+contact+lens&iax=images&ia=images',
  'https://archive.org/wayback/available?url=acuvue.co.kr',
  // 식약처
  'https://nedrug.mfds.go.kr/searchDrug',
];

async function probe(url: string): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);
    const buf = await r.arrayBuffer();
    return {
      url,
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get('content-type'),
      bytes: buf.byteLength,
      redirected: r.redirected,
      finalUrl: r.url,
      ms: Date.now() - t0,
    };
  } catch (e: unknown) {
    return {
      url,
      ok: false,
      status: 0,
      contentType: null,
      bytes: 0,
      redirected: false,
      finalUrl: url,
      error: (e as Error).message,
      ms: Date.now() - t0,
    };
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && !user.isMaster)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const results = await Promise.all(TARGETS.map(probe));
  const summary = {
    accessible: results.filter((r) => r.ok).length,
    blocked: results.filter((r) => !r.ok).length,
    totalBytes: results.reduce((s, r) => s + r.bytes, 0),
  };

  return NextResponse.json({ summary, results }, {
    headers: { 'cache-control': 'no-store' },
  });
}
