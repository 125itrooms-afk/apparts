import { CheckCircle2, Clock, PhoneCall } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { track, trackFormStart } from '../core/analytics';
import { submitLead } from '../core/leads';
import { openPanel, useApp } from '../core/store';
import { callSlots, cx, isValidPhone, isWorkingTime, responsePromise } from '../core/util';
import { Consent, Honeypot, PanelShell, PhoneInput, SubmittedNote, useIsMobile } from './shared';

export function CallbackPanel({ preview }: { preview?: boolean }) {
  const cfg = useApp((s) => s.config.widgets.callback);
  const hours = useApp((s) => s.config.hours);
  const mobile = useIsMobile();
  const [phone, setPhone] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [slot, setSlot] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { num: number; repeat: boolean }>(null);
  const openedAt = useRef(Date.now());
  const working = isWorkingTime(hours);
  const slots = callSlots(hours);

  useEffect(() => {
    if (!preview) track('widget_open', 'callback');
  }, [preview]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (preview) return setError('Это предпросмотр в редакторе - заявки отсюда не создаются.');
    if (!isValidPhone(phone)) return setError('Введите номер полностью: +7 (9XX) XXX-XX-XX');
    const res = submitLead({
      source: 'callback',
      phone,
      consent,
      website: hp,
      openedAt: openedAt.current,
      preferredTime: when === 'now' ? (working ? 'Как можно скорее' : 'Ближайшее рабочее время') : slot,
    });
    if (!res.ok) return setError(res.error);
    setDone({ num: res.lead.num, repeat: res.repeat });
  };

  return (
    <PanelShell
      title={cfg.title}
      subtitle={cfg.subtitle}
      onClose={() => openPanel(null)}
      className={cx(mobile && !preview ? 'h-full w-full' : 'w-[360px] max-w-full rounded-2xl')}
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center animate-rise">
          <CheckCircle2 className="h-12 w-12 text-ok" />
          <p className="text-base font-bold">Заявка №{done.num} принята</p>
          <p className="text-sm text-ink-soft">
            {when === 'later' && slot
              ? `Перезвоним в выбранное время: ${slot.toLowerCase()}.`
              : `Специалист по бронированию перезвонит ${responsePromise(hours, cfg.promiseMinutes)}.`}
            {done.repeat && ' Мы видим ваше прошлое обращение - менеджер будет в курсе.'}
          </p>
          <SubmittedNote />
        </div>
      ) : (
        <form onSubmit={submit} className="relative flex flex-col gap-3 p-5" onChange={() => trackFormStart('callback')}>
          <Honeypot value={hp} onChange={setHp} />
          <PhoneInput value={phone} onChange={setPhone} autoFocus={!preview && !mobile} />
          {cfg.allowSchedule && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Когда позвонить">
                {(
                  [
                    ['now', working ? 'Сейчас' : 'Как можно раньше'],
                    ['later', 'Выбрать время'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    role="radio"
                    aria-checked={when === v}
                    onClick={() => setWhen(v)}
                    className={cx(
                      'flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition',
                      when === v ? 'border-brand bg-brand/5 text-brand' : 'border-paper-line text-ink-soft hover:border-ink/30',
                    )}
                  >
                    {v === 'now' ? <PhoneCall className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    {l}
                  </button>
                ))}
              </div>
              {when === 'later' && (
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="h-10 rounded-xl border border-paper-line bg-white px-3 text-sm focus:border-brand focus:outline-none"
                  aria-label="Удобное время"
                >
                  <option value="">Удобное время…</option>
                  {slots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <Consent checked={consent} onChange={setConsent} />
          {error && <p className="text-xs font-semibold text-bad" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={when === 'later' && !slot}
            className="h-12 rounded-xl bg-brand text-base font-bold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {cfg.button}
          </button>
          <p className="text-center text-[11.5px] text-ink-mute">
            {working
              ? `Перезваниваем ${responsePromise(hours, cfg.promiseMinutes)}`
              : `Сейчас нерабочее время. Перезвоним с ${hours.from}`}
          </p>
        </form>
      )}
    </PanelShell>
  );
}
