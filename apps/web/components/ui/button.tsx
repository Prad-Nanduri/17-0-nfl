import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'small' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-action text-on-action hover:bg-action-hover',
  secondary: 'border border-line bg-surface text-ink hover:border-ink hover:bg-subtle',
  ghost: 'bg-transparent text-ink hover:bg-subtle',
};
const sizes: Record<ButtonSize, string> = {
  default: 'min-h-12 px-6 py-3',
  small: 'min-h-11 px-4 py-2',
  icon: 'h-11 w-11 p-2',
};

export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'default') {
  return `inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-control text-small font-bold transition-[color,background-color,border-color,transform] duration-settle ease-settle active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/** Use <Button variant="secondary"> for supporting actions; loading preserves its footprint. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    loading = false,
    disabled,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${buttonStyles(variant, size)} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block h-2 w-6 rounded-badge bg-current opacity-50"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
});
