'use client';

import { forwardRef } from 'react';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, variant = 'default', className, ...props }, ref) => {
    const pct = Math.min((value / max) * 100, 100);
    return (
      <div
        ref={ref}
        className={`relative h-2 w-full overflow-hidden rounded-full bg-secondary ${className ?? ''}`}
        {...props}
      >
        <div
          className={`h-full w-full flex-1 transition-all duration-300 ${variantStyles[variant] ?? variantStyles.default}`}
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
