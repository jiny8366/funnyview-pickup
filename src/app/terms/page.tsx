import Link from 'next/link';
import { PrintButton } from '@/components/ui/print-button';
import { TERMS } from '@/lib/terms';

export const metadata = { title: '이용약관 · 퍼니뷰 예약시스템' };

export default function TermsPage() {
  const sections = TERMS.filter((t) => t.group === 'service');
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:py-12">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-gray-500 transition hover:text-brand-600 print:hidden">
          ← 홈으로
        </Link>
        <PrintButton />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">이용약관</h1>
      <div className="mt-8 space-y-10">
        {sections.map((s) => (
          <section key={s.key}>
            <h2 className="text-base font-bold text-gray-900">{s.prompt.replace(/에 동의하십니까\?$/, '')}</h2>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-600">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
