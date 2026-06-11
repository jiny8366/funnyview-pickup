import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      screens: {
        xs: '375px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      // ── Apple 스타일 디자인 토큰 (UI/UX 고도화 — 합의 토큰) ──
      // depth: 은은한 다층 그림자
      boxShadow: {
        card: '0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)',
        elevated: '0 4px 16px rgba(17,24,39,0.08), 0 2px 6px rgba(17,24,39,0.04)',
        pop: '0 12px 32px rgba(17,24,39,0.14), 0 4px 8px rgba(17,24,39,0.06)',
      },
      // 모션 easing: 표준(apple)·진입(out-soft)·스프링(press/pop 오버슈트)
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'out-soft': 'cubic-bezier(0, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        250: '250ms',
        350: '350ms',
      },
      animation: {
        'slide-up': 'slideUp 250ms cubic-bezier(0,0,0.2,1)',
        'fade-in': 'fadeIn 200ms ease-out',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34,1.56,0.64,1)',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
