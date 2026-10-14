import { Info, X } from 'lucide-react';
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../core/util';

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft';
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-brand text-brand-ink hover:brightness-110',
        variant === 'outline' && 'border border-paper-line bg-white text-ink hover:border-ink/30',
        variant === 'ghost' && 'text-ink-soft hover:bg-paper-sunk',
        variant === 'soft' && 'bg-paper-sunk text-ink hover:bg-paper-line',
        variant === 'danger' && 'bg-bad text-white hover:brightness-110',
        className,
      )}
    />
  );
}

export function Demo({ className, children = 'DEMO' }: { className?: string; children?: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border border-dashed border-warn/60 bg-warn/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warn',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' | 'info'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        tone === 'neutral' && 'bg-paper-sunk text-ink-soft',
        tone === 'ok' && 'bg-ok/10 text-ok',
        tone === 'warn' && 'bg-warn/10 text-warn',
        tone === 'bad' && 'bg-bad/10 text-bad',
        tone === 'brand' && 'bg-brand/10 text-brand',
        tone === 'info' && 'bg-sage-soft text-sage',
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-paper-line bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line px-4 py-3">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('inline-flex cursor-pointer select-none items-center gap-2 text-sm', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-paper-line transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
      {label && <span className="text-ink">{label}</span>}
    </label>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-ink-mute">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'h-10 w-full min-w-0 rounded-xl border border-paper-line bg-white px-3 text-sm text-ink placeholder:text-ink-mute focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-paper-sunk';

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'h-auto min-h-[72px] py-2', p.className)} />;
}
export function Select({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...p} className={cx(inputCls, 'pr-8', p.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Formula({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-ink-mute" aria-label={'Формула: ' + text} tabIndex={0} />
      <span className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-60 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-[11px] font-normal leading-snug text-white shadow-float group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={cx('flex h-full w-full flex-col bg-paper shadow-float animate-rise', wide ? 'max-w-3xl' : 'max-w-xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-paper-line bg-white px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-mute hover:bg-paper-sunk" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-paper-sunk p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-paper-line bg-white/60 px-6 py-10 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      {text && <p className="max-w-md text-sm text-ink-soft">{text}</p>}
      {action}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
