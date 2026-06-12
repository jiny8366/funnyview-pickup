'use client';

/**
 * 현재 페이지를 인쇄(브라우저 'PDF로 저장')하는 공용 버튼 — 단일 표준 소스. 인쇄물엔 미표시.
 * variant: 'light'(기본, 흰 배경 보조버튼) | 'dark'(짙은 강조버튼).
 */
export function PrintButton({
  label = '🖨 PDF 저장 · 인쇄',
  variant = 'light',
  className = '',
}: {
  label?: string;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const styles =
    variant === 'dark'
      ? 'bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black'
      : 'border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50';
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`rounded-lg print:hidden ${styles} ${className}`}
    >
      {label}
    </button>
  );
}
