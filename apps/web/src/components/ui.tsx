import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/* Presentational primitives. No client hooks here, so they render on the server
   too; interactive pages that use them opt into 'use client' themselves. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-ink hover:bg-brand-hover font-semibold shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]',
  secondary: 'bg-surface-3 text-ink hover:bg-border-strong border border-border',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  outline: 'border border-border-strong text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white border border-danger/30',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'border-border bg-surface/80 rounded-[var(--radius)] border backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'accent' | 'info' | 'warn' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-muted border-border',
    brand: 'bg-brand-soft text-brand border-brand/30',
    accent: 'bg-accent-soft text-accent border-accent/30',
    info: 'bg-info-soft text-info border-info/30',
    warn: 'bg-[#33290f] text-warn border-warn/30',
    danger: 'bg-danger-soft text-danger border-danger/30',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-ink-muted text-sm">{label}</span>
        {icon && <span className="text-brand">{icon}</span>}
      </div>
      <div className="font-display mt-2 text-3xl tracking-tight">{value}</div>
      {sub && <div className="text-ink-faint mt-1 text-xs">{sub}</div>}
    </Card>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('text-ink-muted size-5 animate-spin', className)} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'border-border bg-surface-2 text-ink placeholder:text-ink-faint w-full rounded-lg border px-3 py-2 text-sm',
        'focus:border-brand/60 focus:ring-brand/40 focus:ring-1 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'border-border bg-surface-2 text-ink placeholder:text-ink-faint w-full rounded-lg border px-3 py-2 text-sm',
        'focus:border-brand/60 focus:ring-brand/40 focus:ring-1 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink-muted mb-1.5 flex items-center justify-between text-xs font-medium tracking-wide uppercase">
        {label}
        {hint && <span className="text-ink-faint font-normal normal-case">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed px-6 py-14 text-center">
      {icon && <div className="text-ink-faint mb-3">{icon}</div>}
      <h3 className="font-display text-ink text-lg">{title}</h3>
      {description && <p className="text-ink-muted mt-1 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface-3 animate-pulse rounded-md', className)} />;
}
