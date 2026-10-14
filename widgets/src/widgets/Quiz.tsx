import { ArrowLeft, Baby, Briefcase, CalendarRange, CheckCircle2, Home, Loader2, Palmtree, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { track, trackFormStart } from '../core/analytics';
import { bnovoSource, bookingUrl, getOffers, type CategoryOffer } from '../core/integrations';
import { submitLead } from '../core/leads';
import { markVisitorAction, openPanel, useApp } from '../core/store';
import { cx, isoDate, isValidPhone, money, nightsBetween, ruDate, safeStorage } from '../core/util';
import { Consent, DemoNote, Honeypot, PanelShell, PhoneInput, SubmittedNote, useIsMobile } from './shared';
import { categoriesFor } from '../core/defaults';

const KEY = 'v125-quiz-progress';

interface Answers {
  purpose?: string;
  adults: number;
  kids: number;
  checkIn?: string;
  checkOut?: string;
  prefs: string[];
  wish: string;
}

const PURPOSES = [
  { v: 'Отдых', icon: Palmtree },
  { v: 'Командировка', icon: Briefcase },
  { v: 'Семейная поездка', icon: Baby },
  { v: 'Длительное проживание', icon: Home },
];
const PREFS = ['Полноценная кухня', 'Рабочее место', 'Отдельная спальня', 'Детская кроватка', 'Парковка', 'Тихий этаж', 'Закрывающие документы', 'Ранний заезд'];

const empty: Answers = { adults: 2, kids: 0, prefs: [], wish: '' };

export function loadQuizProgress(): { step: number; a: Answers } | null {
  return safeStorage.get(KEY, null);
}

export function QuizPanel({ preview }: { preview?: boolean }) {
  const cfg = useApp((s) => s.config.widgets.quiz);
  const mobile = useIsMobile();
  const saved = preview ? null : loadQuizProgress();
  const [step, setStep] = useState(saved?.step ?? 0);
  const [a, setA] = useState<Answers>(saved?.a ?? empty);
  const [offers, setOffers] = useState<CategoryOffer[] | null | 'loading' | 'error'>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const openedAt = useRef(Date.now());
  const source = useApp(() => bnovoSource());
  const total = 5;

  useEffect(() => {
    if (!preview) track('widget_open', 'quiz');
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    if (done) safeStorage.del(KEY);
    else safeStorage.set(KEY, { step, a });
  }, [step, a, done, preview]);

  useEffect(() => {
    if (step !== 4 || !a.checkIn || !a.checkOut) return;
    if (source === 'none') return setOffers(null);
    setOffers('loading');
    getOffers(a.checkIn, a.checkOut, a.adults + a.kids)
      .then((o) => setOffers(o))
      .catch(() => setOffers('error'));
  }, [step, a.checkIn, a.checkOut, a.adults, a.kids, source]);

  const go = (n: number) => {
    setStep(n);
    if (!preview) {
      track('quiz_step', 'quiz', { step: n + 1 });
      trackFormStart('quiz');
    }
  };

  const today = isoDate(new Date());
  const nights = nightsBetween(a.checkIn, a.checkOut);
  const canNext = [
    !!a.purpose,
    a.adults >= 1,
    !!a.checkIn && !!a.checkOut && nights > 0,
    true,
    true,
  ][step];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (preview) return setError('Предпросмотр: заявки не создаются.');
    if (!isValidPhone(phone)) return setError('Введите номер полностью: +7 (9XX) XXX-XX-XX');
    const res = submitLead({
      source: 'quiz',
      phone,
      name,
      consent,
      website: hp,
      openedAt: openedAt.current,
      quiz: {
        Цель: a.purpose ?? '',
        Гости: `${a.adults} взр.${a.kids ? ` + ${a.kids} дет.` : ''}`,
        Даты: a.checkIn && a.checkOut ? `${ruDate(a.checkIn)}-${ruDate(a.checkOut)} (${nights} ноч.)` : '',
        Пожелания: [...a.prefs, a.wish].filter(Boolean).join(', '),
      },
      clientHistory: ['Прошёл квиз подбора апартаментов'],
    });
    if (!res.ok) return setError(res.error);
    setDone(res.lead.num);
  };

  return (
    <PanelShell
      title={cfg.title}
      subtitle={done ? undefined : `Шаг ${Math.min(step + 1, total)} из ${total}`}
      onClose={() => openPanel(null)}
      className={cx(mobile && !preview ? 'h-full w-full' : 'max-h-full w-[520px] max-w-full rounded-2xl')}
    >
      <div className="h-1 bg-paper-sunk" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
        <div className="h-full bg-brand transition-all duration-500" style={{ width: `${done ? 100 : ((step + 1) / total) * 100}%` }} />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center animate-rise">
            <CheckCircle2 className="h-12 w-12 text-ok" />
            <p className="text-base font-bold">Заявка №{done} на подбор принята</p>
            <p className="max-w-sm text-sm text-ink-soft">Специалист проверит варианты на ваши даты и свяжется с вами. Ответы квиза уже у менеджера - повторять не придётся.</p>
            <SubmittedNote />
          </div>
        ) : (
          <div key={step} className="animate-rise">
            {step === 0 && (
              <Step title="Какая цель поездки?">
                <div className="grid grid-cols-2 gap-2">
                  {PURPOSES.map(({ v, icon: Icon }) => (
                    <button
                      key={v}
                      onClick={() => {
                        setA({ ...a, purpose: v });
                        if (v === 'Длительное проживание') markVisitorAction('long_stay_interest');
                        go(1);
                      }}
                      className={cx(
                        'flex flex-col items-start gap-3 rounded-xl border p-4 text-left text-sm font-semibold transition',
                        a.purpose === v ? 'border-brand bg-brand/5' : 'border-paper-line hover:border-ink/30',
                      )}
                    >
                      <Icon className="h-5 w-5 text-brand" />
                      {v}
                    </button>
                  ))}
                </div>
              </Step>
            )}
            {step === 1 && (
              <Step title="Сколько будет гостей?">
                <Counter label="Взрослые" value={a.adults} min={1} max={8} onChange={(v) => setA({ ...a, adults: v })} />
                <Counter label="Дети" value={a.kids} min={0} max={6} onChange={(v) => setA({ ...a, kids: v })} />
              </Step>
            )}
            {step === 2 && (
              <Step title="Даты заезда и выезда">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
                    Заезд
                    <input type="date" min={today} value={a.checkIn ?? ''} onChange={(e) => setA({ ...a, checkIn: e.target.value })} className="h-11 rounded-xl border border-paper-line px-3 text-sm text-ink" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
                    Выезд
                    <input type="date" min={a.checkIn || today} value={a.checkOut ?? ''} onChange={(e) => setA({ ...a, checkOut: e.target.value })} className="h-11 rounded-xl border border-paper-line px-3 text-sm text-ink" />
                  </label>
                </div>
                {nights > 0 && (
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <CalendarRange className="h-4 w-4" /> {nights} ноч.
                    {nights >= 14 && ' - для длительного проживания действуют отдельные условия'}
                  </p>
                )}
              </Step>
            )}
            {step === 3 && (
              <Step title="Что для вас важно?">
                <div className="flex flex-wrap gap-2">
                  {PREFS.map((p) => {
                    const on = a.prefs.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => setA({ ...a, prefs: on ? a.prefs.filter((x) => x !== p) : [...a.prefs, p] })}
                        aria-pressed={on}
                        className={cx('rounded-full border px-3 py-1.5 text-sm font-medium transition', on ? 'border-brand bg-brand text-brand-ink' : 'border-paper-line hover:border-ink/30')}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={a.wish}
                  onChange={(e) => setA({ ...a, wish: e.target.value })}
                  placeholder="Дополнительные пожелания (необязательно)"
                  className="min-h-[72px] w-full rounded-xl border border-paper-line p-3 text-sm"
                  maxLength={500}
                />
              </Step>
            )}
            {step === 4 && (
              <Step title="Результат подбора">
                <p className="text-sm text-ink-soft">
                  {a.purpose} · {a.adults + a.kids} гост. · {a.checkIn && ruDate(a.checkIn)}-{a.checkOut && ruDate(a.checkOut)} ({nights} ноч.)
                </p>
                {offers === 'loading' && (
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 className="h-4 w-4 animate-spin" /> Проверяем наличие в системе бронирования…
                  </p>
                )}
                {offers === 'error' && <p className="text-sm text-bad">Система бронирования не ответила. Оставьте телефон - подберём вручную.</p>}
                {Array.isArray(offers) && (
                  <div className="flex flex-col gap-2">
                    {source === 'demo' && <DemoNote>Наличие и цены ниже - демонстрационные данные, не из Bnovo.</DemoNote>}
                    {offers.filter((o) => o.available > 0).length === 0 && <p className="text-sm">На эти даты свободных подходящих категорий нет. Специалист предложит альтернативы.</p>}
                    {offers
                      .filter((o) => o.available > 0)
                      .slice(0, 3)
                      .map((o) => (
                        <div key={o.key} className="flex items-center justify-between gap-3 rounded-xl border border-paper-line p-3">
                          <div className="min-w-0">
                            <p className="font-bold">{o.name}</p>
                            <p className="text-xs text-ink-mute">до {o.maxGuests} гостей</p>
                          </div>
                          <div className="text-right">
                            {o.price && <p className="font-bold tabular-nums">{money(o.price)}</p>}
                            <a
                              href={bookingUrl(a.checkIn, a.checkOut, a.adults)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => track('booking_click', 'quiz')}
                              className="text-xs font-semibold text-brand underline underline-offset-2"
                            >
                              Забронировать ↗
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                {offers === null && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">Подходят по вместимости:</p>
                    {categoriesFor(a.adults + a.kids)
                      .slice(0, 3)
                      .map((c) => (
                        <div key={c.key} className="flex items-center justify-between gap-3 rounded-xl border border-paper-line p-3">
                          <div className="min-w-0">
                            <p className="font-bold">{c.name}</p>
                            <p className="text-xs text-ink-mute">
                              {c.area} м² · до {c.maxGuests} гостей · {c.levels === 2 ? '2 уровня' : '1 уровень'}
                            </p>
                          </div>
                          <p className="shrink-0 text-right text-sm">
                            от <b className="tabular-nums">{money(c.fromPrice)}</b>
                            <span className="block text-[11px] text-ink-mute">за ночь</span>
                          </p>
                        </div>
                      ))}
                    <p className="text-[11.5px] text-ink-mute">
                      Цены «от» с сайта. Наличие и точную стоимость на ваши даты{' '}
                      <a href={bookingUrl(a.checkIn, a.checkOut, a.adults + a.kids)} target="_blank" rel="noreferrer" onClick={() => track('booking_click', 'quiz')} className="font-semibold text-brand underline underline-offset-2">
                        покажет модуль бронирования ↗
                      </a>{' '}
                      или подберёт специалист.
                    </p>
                  </div>
                )}
                <form onSubmit={submit} className="relative mt-1 flex flex-col gap-2.5 border-t border-paper-line pt-4">
                  <Honeypot value={hp} onChange={setHp} />
                  <p className="text-sm font-bold">Получить подборку от специалиста</p>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя (необязательно)" autoComplete="given-name" className="h-11 rounded-xl border border-paper-line px-3 text-sm" />
                  <PhoneInput value={phone} onChange={setPhone} />
                  <Consent checked={consent} onChange={setConsent} />
                  {error && <p className="text-xs font-semibold text-bad" role="alert">{error}</p>}
                  <button type="submit" className="h-12 rounded-xl bg-brand font-bold text-brand-ink hover:brightness-110">
                    Получить подборку
                  </button>
                </form>
              </Step>
            )}
          </div>
        )}
      </div>
      {!done && (
        <div className="flex items-center justify-between gap-2 border-t border-paper-line bg-white px-5 py-3">
          <button
            onClick={() => go(Math.max(0, step - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft disabled:opacity-0"
          >
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          {step < 4 && (
            <button onClick={() => go(step + 1)} disabled={!canNext} className="h-10 rounded-xl bg-brand px-5 text-sm font-bold text-brand-ink disabled:opacity-40">
              Далее
            </button>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-paper-line p-3">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-brand" />
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="h-9 w-9 rounded-lg border border-paper-line text-lg" aria-label={`Меньше: ${label}`}>
          −
        </button>
        <span className="w-6 text-center text-base font-bold tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="h-9 w-9 rounded-lg border border-paper-line text-lg" aria-label={`Больше: ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
