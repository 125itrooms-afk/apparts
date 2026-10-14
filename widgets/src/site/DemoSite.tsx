import { ArrowRight, Briefcase, CalendarDays, Coffee, KeyRound, MapPin, Wifi } from 'lucide-react';
import { useState } from 'react';
import { track } from '../core/analytics';
import { CATEGORIES } from '../core/defaults';
import { bookingUrl } from '../core/integrations';
import { resolvePersonalization } from '../core/rules';
import { markVisitorAction, navigate, openPanel, useApp } from '../core/store';
import { cx, isoDate } from '../core/util';
import { loadQuizProgress } from '../widgets/Quiz';
import hero from '../assets/site-hero-s.webp';
import imgStd from '../assets/site-uyut-st-1-s.webp';
import imgComfort from '../assets/site-uyut-cf-1-s.webp';
import imgMini from '../assets/site-mini-1-s.webp';
import imgPrestige from '../assets/site-prestige-1-s.webp';
import imgProstor from '../assets/site-prostor-1-s.webp';
import imgLux from '../assets/site-lux-1-s.webp';
import imgFamily from '../assets/site-family-1-s.webp';
import reception from '../assets/site-reception-s.webp';

const PAGES = [
  { path: '/', label: 'Главная' },
  { path: '/apartments', label: 'Апартаменты' },
  { path: '/prices', label: 'Цены' },
  { path: '/long-stay', label: 'Надолго' },
  { path: '/corporate', label: 'Компаниям' },
  { path: '/contacts', label: 'Контакты' },
];

const IMG: Record<string, string> = { std: imgStd, comfort: imgComfort, mini: imgMini, prestige: imgPrestige, prostor: imgProstor, lux: imgLux, family: imgFamily };

function Photo({ src, className, alt }: { src: string; className?: string; alt: string }) {
  return (
    <div className={cx('relative overflow-hidden bg-paper-sunk', className)}>
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

export function DemoSite() {
  const path = useApp((s) => s.sim.path);
  const mobile = useApp((s) => s.sim.frame === 'mobile');
  // пересчёт персонализации при смене контекста посетителя
  useApp((s) => s.visitor.utm.utm_campaign + s.visitor.visits + s.visitor.referrer + s.config.widgets.personalization.segments.length);
  const pers = resolvePersonalization();

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <header className="sticky top-0 z-10 border-b border-paper-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <button onClick={() => navigate('/')} className="flex items-baseline gap-1.5 text-left">
            <span className="font-display text-xl leading-none">Варшавка</span>
            <span className="font-display text-xl leading-none text-sage">125</span>
          </button>
          <nav className={cx('ml-auto flex gap-1 overflow-x-auto', mobile && 'hidden')}>
            {PAGES.map((p) => (
              <button
                key={p.path}
                onClick={() => navigate(p.path)}
                className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', path === p.path ? 'bg-paper-sunk text-ink' : 'text-ink-soft hover:text-ink')}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <a
            href={bookingUrl()}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('booking_click')}
            className={cx('rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white', mobile && 'ml-auto')}
          >
            Забронировать
          </a>
        </div>
        {mobile && (
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {PAGES.map((p) => (
              <button key={p.path} onClick={() => navigate(p.path)} className={cx('whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium', path === p.path ? 'bg-paper-sunk text-ink' : 'text-ink-soft')}>
                {p.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {path === '/' && <Home pers={pers} mobile={mobile} />}
      {path === '/apartments' && <Apartments mobile={mobile} />}
      {path === '/prices' && <Prices />}
      {path === '/long-stay' && <LongStay mobile={mobile} />}
      {path === '/corporate' && <Corporate mobile={mobile} />}
      {path === '/contacts' && <Contacts />}

      <footer className="mt-16 border-t border-paper-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-ink-mute">
          <span>Апарт-отель «Варшавка 125» · демонстрационная страница для показа виджетов</span>
          <span>Фото - с сайта w125.ru</span>
        </div>
      </footer>
    </div>
  );
}

function Home({ pers, mobile }: { pers: ReturnType<typeof resolvePersonalization>; mobile: boolean }) {
  const quizOn = useApp((s) => s.config.widgets.quiz.enabled && s.config.widgets.quiz.showInlineOnHome);
  const quizText = useApp((s) => s.config.widgets.quiz.launcherText);
  const resume = loadQuizProgress();
  return (
    <>
      <section className={cx('mx-auto grid max-w-6xl gap-6 px-4 pt-6 sm:px-6', !mobile && 'grid-cols-[1.05fr_1fr] pt-10')}>
        <div className="flex flex-col justify-center gap-5 py-4">
          {pers.segment && (
            <span className="w-fit rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage">
              Персонализация: {pers.segment.name}
              {pers.variant && ` · вариант ${pers.variant}`}
            </span>
          )}
          <h1 className={cx('font-display leading-[1.08] text-ink', mobile ? 'text-[34px]' : 'text-5xl')} style={{ textWrap: 'balance' } as React.CSSProperties}>
            {pers.headline}
          </h1>
          <p className="max-w-md text-base text-ink-soft">{pers.subline}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                track('widget_open', 'personalization', { cta: pers.cta });
                openPanel('quiz');
              }}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white"
            >
              {pers.cta} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => navigate('/apartments')} className="h-12 rounded-xl border border-paper-line bg-white px-5 text-sm font-semibold">
              Смотреть апартаменты
            </button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm text-ink-soft">
            <li className="flex items-center gap-1.5"><Coffee className="h-4 w-4 text-sage" /> Кухня в апартаментах</li>
            <li className="flex items-center gap-1.5"><Wifi className="h-4 w-4 text-sage" /> Рабочее место</li>
            <li className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-sage" /> 66 апартаментов</li>
          </ul>
        </div>
        <div className={cx('grid grid-cols-3 grid-rows-2 gap-3', mobile && 'order-first')}>
          <Photo src={hero} alt="Престиж: спальня на антресоли" className={cx('col-span-2 row-span-2 rounded-3xl', mobile ? 'aspect-[4/3.2]' : 'min-h-[300px]')} />
          <Photo src={imgFamily} alt="Номер с кухней" className="rounded-3xl" />
          <Photo src={imgLux} alt="Люкс" className="rounded-3xl" />
        </div>
      </section>

      <BookingBar mobile={mobile} />

      {quizOn && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
          <div className={cx('flex items-start justify-between gap-4 rounded-3xl bg-ink p-6 text-white', mobile ? 'flex-col' : 'flex-row items-center p-8')}>
            <div>
              <p className="font-display text-2xl">{resume ? 'Продолжим подбор?' : 'Не знаете, какую категорию выбрать?'}</p>
              <p className="mt-1 text-sm text-white/70">{resume ? 'Ваши ответы сохранены - осталось несколько шагов.' : '5 коротких вопросов - и специалист предложит подходящие варианты.'}</p>
            </div>
            <button onClick={() => openPanel('quiz')} className="h-12 shrink-0 rounded-xl bg-white px-5 text-sm font-bold text-ink">
              {resume ? 'Продолжить' : quizText}
            </button>
          </div>
        </section>
      )}
      <Apartments compact mobile={mobile} />
    </>
  );
}

function BookingBar({ mobile }: { mobile: boolean }) {
  const [inD, setIn] = useState(isoDate(new Date(Date.now() + 86400000 * 7)));
  const [outD, setOut] = useState(isoDate(new Date(Date.now() + 86400000 * 9)));
  const [adults, setAdults] = useState(2);
  return (
    <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
      <div className={cx('grid gap-3 rounded-2xl border border-paper-line bg-white p-4 shadow-card', mobile ? 'grid-cols-2' : 'grid-cols-[1fr_1fr_120px_auto] items-end')}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Заезд
          <input type="date" value={inD} onChange={(e) => setIn(e.target.value)} className="h-11 rounded-xl border border-paper-line px-3 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Выезд
          <input type="date" value={outD} onChange={(e) => setOut(e.target.value)} className="h-11 rounded-xl border border-paper-line px-3 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Гости
          <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="h-11 rounded-xl border border-paper-line px-3 text-sm text-ink">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <a
          href={bookingUrl(inD, outD, adults)}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('booking_click', undefined, { from: 'site_bar' })}
          className={cx('grid h-11 place-items-center rounded-xl bg-ink px-6 text-sm font-bold text-white', mobile && 'self-end')}
        >
          Найти ↗
        </a>
        <p className={cx('text-[11px] text-ink-mute', mobile ? 'col-span-2' : 'col-span-4')}>Существующий модуль бронирования Bnovo открывается с выбранными датами. Виджеты его не заменяют и не перекрывают.</p>
      </div>
    </section>
  );
}

function Apartments({ compact, mobile }: { compact?: boolean; mobile?: boolean }) {
  return (
    <section id="rooms" className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="font-display text-3xl">Категории апартаментов</h2>
        {compact && (
          <button onClick={() => navigate('/apartments')} className="text-sm font-semibold text-sage underline underline-offset-4">
            Все категории
          </button>
        )}
      </div>
      <div className={cx('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-3')}>
        {(compact ? CATEGORIES.slice(1, 4) : CATEGORIES).map((c) => (
          <article key={c.key} className="overflow-hidden rounded-3xl border border-paper-line bg-white">
            <Photo src={IMG[c.key]} alt={c.name} className="aspect-[3/2]" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <h3 className="text-lg font-bold">{c.name}</h3>
                <p className="text-xs text-ink-mute">{c.area} м² · до {c.maxGuests} гостей · от {c.fromPrice.toLocaleString('ru-RU')} ₽ / ночь</p>
              </div>
              <a
                href={bookingUrl()}
                target="_blank"
                rel="noreferrer"
                onClick={() => track('booking_click', undefined, { category: c.key })}
                className="rounded-xl border border-paper-line px-3 py-2 text-xs font-semibold hover:border-ink/40"
              >
                Цены и даты ↗
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Prices() {
  return (
    <section id="rooms" className="mx-auto mt-10 max-w-3xl px-4 sm:px-6">
      <h1 className="font-display text-4xl">Цены</h1>
      <p className="mt-3 text-ink-soft">
        Стоимость зависит от дат, категории и срока проживания. Актуальные цены всегда в модуле бронирования - мы не публикуем статичный прайс, чтобы не вводить в заблуждение.
      </p>
      <div className="mt-6 flex flex-col divide-y divide-paper-line rounded-2xl border border-paper-line bg-white">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="font-semibold">{c.name}</span>
            <a href={bookingUrl()} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sage underline underline-offset-4">
              Узнать цену на даты ↗
            </a>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-mute">Сценарий «Долго изучает номера и цены» срабатывает, когда этот блок 25 секунд на экране.</p>
    </section>
  );
}

function LongStay({ mobile }: { mobile: boolean }) {
  return (
    <section className={cx('mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6', !mobile && 'grid-cols-2')}>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl">Длительное проживание</h1>
        <p className="text-ink-soft">Апартаменты с кухней и рабочим местом для проживания от двух недель. Условия рассчитываются индивидуально по сроку и категории.</p>
        <button
          onClick={() => {
            markVisitorAction('long_stay_interest');
            track('widget_open', 'personalization', { action: 'long_stay_interest' });
          }}
          className="h-12 w-fit rounded-xl bg-ink px-5 text-sm font-bold text-white"
        >
          Рассчитать условия
        </button>
        <p className="text-xs text-ink-mute">Кнопка отмечает действие «long_stay_interest» - на него настроен сценарий генератора заявок.</p>
      </div>
      <Photo src={imgStd} alt="Уют стандарт: стол у окна" className="aspect-[4/3] rounded-3xl" />
    </section>
  );
}

function Corporate({ mobile }: { mobile: boolean }) {
  return (
    <section className={cx('mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6', !mobile && 'grid-cols-2')}>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl">Компаниям</h1>
        <p className="text-ink-soft">Размещение сотрудников и командированных: договор, безналичная оплата, отчётные документы.</p>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-sage" /> Рабочее место в апартаментах</li>
          <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sage" /> Любой срок проживания</li>
        </ul>
        <button onClick={() => openPanel('callback')} className="h-12 w-fit rounded-xl bg-ink px-5 text-sm font-bold text-white">
          Запросить предложение
        </button>
      </div>
      <Photo src={reception} alt="Ресепшн" className="aspect-[4/3] rounded-3xl" />
    </section>
  );
}

function Contacts() {
  const c = useApp((s) => s.config.contacts);
  return (
    <section className="mx-auto mt-10 max-w-3xl px-4 sm:px-6">
      <h1 className="font-display text-4xl">Контакты</h1>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-paper-line bg-white p-5 text-sm">
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-sage" /> {c.address}</p>
        <p>
          Телефон: <span className="select-all font-semibold">{c.phone}</span>
        </p>
        <p className="text-xs text-ink-mute">На этой странице генератор заявок отключён правилом страниц (пример исключения).</p>
      </div>
    </section>
  );
}
