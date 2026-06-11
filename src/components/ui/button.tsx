import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-card hover:bg-brand-700 hover:shadow-elevated disabled:bg-brand-600/50 disabled:shadow-none',
  secondary: 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
  danger: 'bg-red-600 text-white shadow-card hover:bg-red-700',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[transform,background-color,box-shadow,opacity] duration-150 ease-apple active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100',
          VARIANT[variant],
          SIZE[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
