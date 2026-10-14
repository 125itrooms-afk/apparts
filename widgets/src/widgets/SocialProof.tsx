import { CalendarCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { track } from '../core/analytics';
import { getProofSignals, type ProofSignal } from '../core/integrations';
import { useApp } from '../core/store';
import { cx } from '../core/util';
import { useIsMobile, useWidgetVisible } from './shared';

/**
 * Уведомления о бронированиях. Показываются только сигналы, построенные из фактов Bnovo.
 * Нет данных → виджет молчит.
 */
export function SocialProof() {
  const visible = useWidgetVisible('socialProof');
  const cfg = useApp((s) => s.config.widgets.socialProof);
  const returning = useApp((s) => s.visitor.visits > 1);
  const source = useApp((s) => s.sim.bnovoDemo || s.config.integrations.find((i) => i.id === 'bnovo')?.connected);
  const panelOpen = useApp((s) => !!s.open || !!s.popup);
  const mobile = useIsMobile();
  const [current, setCurrent] = useState<ProofSignal | null>(null);
  const shownCount = useRef(0);
  const dismissed = useRef(false);

  const active = visible && !!source && !(cfg.hideForReturning && returning);

  useEffect(() => {
    if (!active) {
      setCurrent(null);
      return;
    }
    const signals = getProofSignals();
    if (!signals.length) return;
    let t1: number;
    let t2: number;
    const showNext = () => {
      if (dismissed.current || shownCount.current >= cfg.maxPerSession) return;
      const s = signals[shownCount.current % signals.length];
      shownCount.current++;
      setCurrent(s);
      track('widget_impression', 'socialProof', { signal: s.id });
      t2 = window.setTimeout(() => {
        setCurrent(null);
        t1 = window.setTimeout(showNext, cfg.intervalSec * 1000);
      }, cfg.displaySec * 1000);
    };
    t1 = window.setTimeout(showNext, cfg.firstDelaySec * 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, cfg.firstDelaySec, cfg.intervalSec, cfg.displaySec, cfg.maxPerSession]);

  if (!current || (mobile && panelOpen)) return null;
  return <ProofToast signal={current} compact={mobile && cfg.mobile === 'compact'} onClose={() => ((dismissed.current = true), setCurrent(null))} />;
}

export function ProofToast({ signal, compact, onClose }: { signal: ProofSignal; compact?: boolean; onClose?: () => void }) {
  return (
    <div
      className={cx('pointer-events-auto flex items-start gap-3 rounded-2xl border border-paper-line bg-white/95 text-ink shadow-float backdrop-blur animate-rise', compact ? 'max-w-[260px] p-2.5' : 'max-w-[320px] p-3.5')}
      role="status"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-soft text-sage">
        <CalendarCheck className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('font-semibold leading-snug', compact ? 'text-[12px]' : 'text-[13px]')}>{signal.text}</p>
        <p className="mt-0.5 text-[10.5px] text-ink-mute">
          По данным системы бронирования{signal.demo && <b className="ml-1 text-warn">· DEMO</b>}
        </p>
      </div>
      {onClose && (
        <button onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-ink-mute hover:text-ink" aria-label="Скрыть уведомление">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
