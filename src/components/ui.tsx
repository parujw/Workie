'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-200',
  secondary:
    'bg-white text-ink border border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:text-ink-faint',
  ghost: 'bg-transparent text-ink-soft hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
};

export function Button({
  variant = 'secondary',
  className = '',
  loading = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Renders a value, or a clear "ยังไม่กำหนด" placeholder when it is blank. */
export function Value({ children }: { children: React.ReactNode }) {
  const empty =
    children === null ||
    children === undefined ||
    children === '' ||
    (typeof children === 'string' && children.trim() === '');
  if (empty) return <span className="text-ink-faint">ยังไม่กำหนด</span>;
  return <>{children}</>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-2">
          ลองใหม่
        </button>
      )}
    </div>
  );
}

/** Marks anything produced by AI that the user has not confirmed yet. */
export function DraftTag({ children = 'ร่างจาก AI — ต้องยืนยันก่อนใช้จริง' }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
      <span aria-hidden>✦</span>
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg px-2 py-1 text-xl leading-none text-ink-muted hover:bg-gray-100"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Copy-to-clipboard with visible confirmation. */
export function CopyButton({ text, label = 'คัดลอก' }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      variant="ghost"
      className="min-h-0 px-2 py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard API is unavailable over plain http on some mobile browsers.
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? 'คัดลอกแล้ว ✓' : label}
    </Button>
  );
}
