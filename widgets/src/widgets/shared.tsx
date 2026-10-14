import { X } from 'lucide-react';
import { createContext, useContext, useId, type ReactNode } from 'react';
import { useApp } from '../core/store';
import type { WidgetId } from '../core/types';
import { cx, maskPhone, pageMatches } from '../core/util';

/** Окружение, в котором живут виджеты: демо-рамка или реальная страница сайта (embed). */
export interface HostEnv {
  /** Элемент, который прокручивается (window на реальном сайте) */
  scrollEl: () => HTMLElement | Window | null;
  embedded: boolean;
}
export const HostCtx = createContext<HostEnv>({ scrollEl: () => window, embedded: false });
export const useHost = () => useContext(HostCtx);

export const useIsMobile = () => useApp((s) => s.sim.frame === 'mobile');

/** Виджет включён, разрешён на текущей странице и на текущем устройстве */
export function useWidgetVisible(id: WidgetId): boolean {
  return useApp((s) => {
    const w = s.config.widgets[id];
    if (!w.enabled) return false;
    if (!pageMatches(s.sim.path, w.pages.include, w.pages.exclude)) return false;
    if (s.sim.frame === 'mobile' && w.mobile === 'hide') return false;
    return true;
  });
}

export function PanelShell({
  title,
  subtitle,
  onClose,
  children,
  className,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
}) {
  return (
    <div className={cx('flex flex-col overflow-hidden bg-white text-ink shadow-float', className)} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="flex items-start gap-3 bg-brand px-5 pb-4 pt-5 text-brand-ink">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold leading-tight">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-[13px] leading-snug opacity-85">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="-mr-1 -mt-1 rounded-lg p-1.5 opacity-80 hover:bg-white/10 hover:opacity-100" aria-label="Закрыть">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function PhoneInput({ value, onChange, autoFocus, id }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; id?: string }) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      autoFocus={autoFocus}
      placeholder="+7 (___) ___-__-__"
      value={value}
      onFocus={() => !value && onChange('+7')}
      onChange={(e) => onChange(e.target.value.length <= 2 ? e.target.value : maskPhone(e.target.value))}
      className="h-12 w-full rounded-xl border border-paper-line bg-white px-4 text-base tracking-wide text-ink placeholder:text-ink-mute focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
    />
  );
}

export function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const url = useApp((s) => s.config.contacts.privacyUrl);
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-snug text-ink-soft">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--v125-brand))]" />
      <span>
        Даю согласие на обработку персональных данных в соответствии с{' '}
        <a href={url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
          политикой конфиденциальности
        </a>
        .
      </span>
    </label>
  );
}

/** Скрытое поле-ловушка для ботов */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-warn/50 bg-warn/5 px-3 py-2 text-[11px] leading-snug text-warn">
      <b>DEMO.</b> {children}
    </p>
  );
}

export function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="currentColor" fontFamily="system-ui, sans-serif">
        MAX
      </text>
    </svg>
  );
}
