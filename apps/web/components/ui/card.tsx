import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'raised';
}

/** Use Card for a distinct content object; put actions inside, never on the container. */
export function Card({ elevation = 'flat', className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-panel bg-surface ${elevation === 'raised' ? 'edged shadow-raised' : 'border border-line'} ${className}`}
      {...props}
    />
  );
}
