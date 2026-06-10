'use client';

/** 현재 페이지를 인쇄(브라우저 'PDF로 저장')하는 버튼. 인쇄물에는 표시되지 않음. */
export function PrintButton({ label = '🖨 PDF 저장 · 인쇄' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 print:hidden"
    >
      {label}
    </button>
  );
}
