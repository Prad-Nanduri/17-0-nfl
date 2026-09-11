import type { HTMLAttributes } from 'react';

const tones = {
  neutral: 'bg-subtle text-muted',
  sport: 'bg-sport/10 text-sport',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof tones;
}

/** Use a short text label; tone supplements the label rather than replacing its meaning. */
export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge px-2 py-1 text-caption font-bold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
