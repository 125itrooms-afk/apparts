import { BedDouble, CalendarDays, MessageCircle, Phone, PhoneIncoming, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { track } from '../core/analytics';
import { bookingUrl } from '../core/integrations';
import { openPanel, useApp } from '../core/store';
import type { MultiItemId } from '../core/types';
import { cx } from '../core/util';
import { MaxIcon, useIsMobile } from './shared';

const ICONS: Record<MultiItemId, (p: { className?: string }) => JSX.Element> = {
  call: (p) => <Phone {...p} />,
  callback: (p) => <PhoneIncoming {...p} />,
  chat: (p) => <MessageCircle {...p} />,
  quiz: (p) => <BedDouble {...p} />,
  telegram: (p) => <Send {...p} />,
  max: (p) => <MaxIcon {...p} />,
  booking: (p) => <CalendarDays {...p} />,
  offers: (p) => <Sparkles {...p} />,
};

export function MultiButton({ preview, forceOpen }: { preview?: boolean; forceOpen?: boolean }) {
  const cfg = useApp((s) => s.config.widgets.multibutton);
  const contacts = useApp((s) => s.config.contacts);
  const chatOn = useApp((s) => s.config.widgets.chat.enabled);
  const cbOn = useApp((s) => s.config.widgets.callback.enabled);
  const mobile = useIsMobile();
  const [open, setOpen] = useState(!!forceOpen);
  const compact = mobile && cfg.mobile === 'compact';
  const size = compact ? 52 : 60;

  useEffect(() => {
    if (!preview) track('widget_impression', 'multibutton');
  }, [preview]);
  useEffect(() => setOpen(!!forceOpen), [forceOpen]);

  const quizOn = useApp((s) => s.config.widgets.quiz.enabled);
  const accent = useApp((s) => s.config.branding.accent);
  // пункт без ссылки не показываем (например, Telegram, если канала нет)
  const items = cfg.items.filter(
    (i) =>
      i.enabled &&
      (i.id !== 'chat' || chatOn) &&
      (i.id !== 'callback' || cbOn) &&
      (i.id !== 'quiz' || quizOn) &&
      (!['telegram', 'max', 'offers'].includes(i.id) || !!href(i.id)),
  );

  function href(id: MultiItemId): string | undefined {
    switch (id) {
      case 'call':
        return 'tel:' + contacts.phone.replace(/[^\d+]/g, '');
      case 'telegram':
        return contacts.telegram;
      case 'max':
        return contacts.max;
      case 'booking':
        return bookingUrl();
      case 'offers':
        return contacts.offersUrl;
    }
  }

  const onItem = (id: MultiItemId) => {
    if (preview) return;
    track('widget_open', 'multibutton', { item: id });
    if (id === 'booking') track('booking_click', 'multibutton');
    if (id === 'callback') openPanel('callback');
    if (id === 'chat') openPanel('chat');
    if (id === 'quiz') openPanel('quiz');
    setOpen(false);
  };

  return (
    <div className={cx('pointer-events-auto relative flex flex-col gap-2', cfg.position === 'left' ? 'items-start' : 'items-end')}>
      {open && (
        <ul className="mb-1 flex w-[272px] max-w-[calc(100vw-40px)] flex-col gap-2" aria-label="Способы связи">
          {items.map((it, i) => {
            const Icon = ICONS[it.id];
            const h = href(it.id);
            const cls = cx(
              'flex w-full items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[13.5px] font-semibold text-ink shadow-card ring-1 ring-paper-line transition hover:-translate-y-0.5 hover:shadow-float',
              cfg.position === 'left' ? '' : 'flex-row-reverse pl-4 pr-1.5',
            );
            const inner = (
              <>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: cfg.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="whitespace-nowrap">{it.label}</span>
              </>
            );
            return (
              <li
                key={it.id}
                className={cfg.animation === 'fan' ? 'animate-pop' : 'animate-rise'}
                style={{ animationDelay: `${(items.length - i) * 35}ms` }}
              >
                {h ? (
                  <a href={h} target={it.id === 'call' ? undefined : '_blank'} rel="noreferrer" className={cls} onClick={() => onItem(it.id)}>
                    {inner}
                  </a>
                ) : (
                  <button className={cls} onClick={() => onItem(it.id)}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
          {items.some((i) => i.id === 'call') && (
            <li className="rounded-full bg-white/95 px-3 py-1 text-center text-[11px] text-ink-soft shadow-card">
              Телефон: <span className="select-all font-semibold text-ink">{contacts.phone}</span>
            </li>
          )}
        </ul>
      )}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && !preview) track('widget_open', 'multibutton');
        }}
        aria-expanded={open}
        aria-label={open ? 'Скрыть способы связи' : 'Связаться с нами'}
        className={cx('relative grid place-items-center rounded-full text-white shadow-float transition-transform hover:scale-105', cfg.pulse && !open && 'animate-ring')}
        style={{ width: size, height: size, background: cfg.color, outline: `2px solid ${accent}`, outlineOffset: 0 }}
      >
        <span className={cx('transition-transform duration-300', open && 'rotate-90')}>
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </span>
      </button>
    </div>
  );
}

/** Одиночные кнопки - если мультикнопка выключена. Всегда в одной колонке, без наложений. */
export function Launchers() {
  const cb = useApp((s) => s.config.widgets.callback);
  const chat = useApp((s) => s.config.widgets.chat);
  const color = useApp((s) => s.config.branding.brand);
  const mobile = useIsMobile();
  const show = (w: { enabled: boolean; showLauncher: boolean; mobile: string }) => w.enabled && w.showLauncher && !(mobile && w.mobile === 'hide');
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
      {show(chat) && (
        <button onClick={() => openPanel('chat')} aria-label="Открыть чат" className="grid h-14 w-14 place-items-center rounded-full text-white shadow-float transition hover:scale-105" style={{ background: color }}>
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {show(cb) && (
        <button onClick={() => openPanel('callback')} aria-label="Заказать обратный звонок" className="grid h-14 w-14 place-items-center rounded-full text-white shadow-float animate-ring transition hover:scale-105" style={{ background: color }}>
          <Phone className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
