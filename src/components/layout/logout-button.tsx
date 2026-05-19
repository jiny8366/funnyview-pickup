'use client';

export function LogoutButton({ className }: { className?: string }) {
  async function onClick() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { redirectTo?: string };
    // hard navigation 으로 세션 쿠키 삭제 반영 + portal 별 적절한 로그인 페이지로 이동
    window.location.replace(body.redirectTo ?? '/');
  }
  return (
    <button
      onClick={onClick}
      className={className ?? 'text-gray-500 hover:text-gray-900'}
      type="button"
    >
      로그아웃
    </button>
  );
}
