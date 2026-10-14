import { Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { resetDemo, setConfig, useApp } from '../core/store';
import type { Config } from '../core/types';
import { cx } from '../core/util';
import { Button, Card, Field, Input, PageHead } from '../ui/kit';
import { useCan } from './AdminApp';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const BRANDS = [
  { brand: '#2f3a36', ink: '#ffffff', name: 'Графит-олива' },
  { brand: '#23262b', ink: '#ffffff', name: 'Графит' },
  { brand: '#5e7a6b', ink: '#ffffff', name: 'Шалфей' },
  { brand: '#33506b', ink: '#ffffff', name: 'Глубокий синий' },
];

const SNIPPET = `<!-- Варшавка 125 · Smart Booking Widgets -->
<script>
  window.V125_WIDGETS_CONFIG = {
    layout: { avoidSelectors: ['.mbar', '#ck'] },
    widgets: {
      personalization: { targets: { headline: '.hero-copy h1', subline: '.hero-copy .sub' } },
      video: { src: 'widgets/v125-tour.mp4', ctaPrimaryHref: '#rooms' },
      leadPopup: { image: 'img/reception-s.webp' }
    }
  };
</script>
<script src="widgets/v125-widgets.js" data-site="varshavka125" data-api="https://w125.ru/api" defer></script>`;

export function SettingsPage() {
  const cfg = useApp((s) => s.config);
  const can = useCan('settings');
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const up = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Настройки" sub="Оформление, контакты, рабочие часы и установка на сайт." />
      <fieldset disabled={!can} className="grid gap-4 xl:grid-cols-2">
        <Card title="Оформление">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {BRANDS.map((b) => (
                <button
                  type="button"
                  key={b.brand}
                  onClick={() => up('branding', { ...cfg.branding, brand: b.brand, brandInk: b.ink })}
                  className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold', cfg.branding.brand === b.brand ? 'border-ink' : 'border-paper-line')}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: b.brand }} />
                  {b.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Основной цвет">
                <input type="color" value={cfg.branding.brand} onChange={(e) => up('branding', { ...cfg.branding, brand: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border border-paper-line" />
              </Field>
              <Field label="Текст на основном цвете">
                <input type="color" value={cfg.branding.brandInk} onChange={(e) => up('branding', { ...cfg.branding, brandInk: e.target.value })} className="h-10 w-full cursor-pointer rounded-xl border border-paper-line" />
              </Field>
            </div>
            <p className="text-[11px] text-ink-mute">Цвет применяется к кнопкам и шапкам всех виджетов. Мультикнопка может иметь свой цвет.</p>
          </div>
        </Card>
        <Card title="Контакты и ссылки">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['phone', 'Телефон отдела бронирования'],
                ['telegram', 'Ссылка Telegram'],
                ['max', 'Ссылка MAX'],
                ['bookingUrl', 'Модуль бронирования'],
                ['offersUrl', 'Спецпредложения'],
                ['privacyUrl', 'Политика обработки ПД'],
                ['address', 'Адрес'],
              ] as [keyof Config['contacts'], string][]
            ).map(([k, l]) => (
              <Field key={k} label={l}>
                <Input value={cfg.contacts[k]} onChange={(e) => up('contacts', { ...cfg.contacts, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-warn">Телефон, Telegram и MAX - заглушки. Укажите реальные контакты перед запуском.</p>
        </Card>
        <Card title="Рабочие часы отдела бронирования">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="С"><Input type="time" value={cfg.hours.from} onChange={(e) => up('hours', { ...cfg.hours, from: e.target.value })} /></Field>
              <Field label="До"><Input type="time" value={cfg.hours.to} onChange={(e) => up('hours', { ...cfg.hours, to: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => {
                const n = i + 1;
                const on = cfg.hours.days.includes(n);
                return (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={on}
                    onClick={() => up('hours', { ...cfg.hours, days: on ? cfg.hours.days.filter((x) => x !== n) : [...cfg.hours.days, n].sort() })}
                    className={cx('h-9 w-10 rounded-lg border text-xs font-semibold', on ? 'border-ink bg-ink text-white' : 'border-paper-line')}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-mute">Вне рабочих часов виджеты обещают ответ с начала рабочего дня, а не «в течение 10 минут».</p>
          </div>
        </Card>
        <Card title="Контроль обработки заявок">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Первое напоминание менеджеру через, мин" hint="Также норматив SLA для «пропущенных»">
              <Input type="number" min={1} value={cfg.reminders.firstAfterMin} onChange={(e) => up('reminders', { ...cfg.reminders, firstAfterMin: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Повторять каждые, мин">
              <Input type="number" min={1} value={cfg.reminders.repeatEveryMin} onChange={(e) => up('reminders', { ...cfg.reminders, repeatEveryMin: Number(e.target.value) || 1 })} />
            </Field>
          </div>
        </Card>
      </fieldset>
      <Card title="Установка на сайт">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-ink-soft">Один скрипт перед &lt;/body&gt;. Виджеты рисуются в Shadow DOM: стили сайта и модуля бронирования не затрагиваются, кнопки не перекрывают виджет Bnovo (настройте его сторону в «Мультикнопке»).</p>
          <pre className="overflow-x-auto rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-white">{SNIPPET}</pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(SNIPPET)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            <span className="text-[11px] text-ink-mute">Без data-api виджеты работают в режиме предпросмотра: заявки не отправляются. Скрипт собирается командой npm run build:embed.</span>
          </div>
        </div>
      </Card>
      <fieldset disabled={!can}>
        <Card title="Совместимость с сайтом">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Мобильная версия до ширины, px">
              <Input type="number" value={cfg.layout.mobileBreakpoint} onChange={(e) => up('layout', { ...cfg.layout, mobileBreakpoint: Number(e.target.value) || 760 })} />
            </Field>
            <Field label="Отступ кнопок снизу, px">
              <Input type="number" value={cfg.layout.bottomOffset} onChange={(e) => up('layout', { ...cfg.layout, bottomOffset: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Не перекрывать элементы сайта" hint="Селекторы через запятую. Виджеты поднимаются над ними.">
              <Input value={cfg.layout.avoidSelectors.join(', ')} onChange={(e) => up('layout', { ...cfg.layout, avoidSelectors: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Шрифт текста"><Input value={cfg.branding.font} onChange={(e) => up('branding', { ...cfg.branding, font: e.target.value })} /></Field>
            <Field label="Шрифт заголовков"><Input value={cfg.branding.fontDisplay} onChange={(e) => up('branding', { ...cfg.branding, fontDisplay: e.target.value })} /></Field>
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">Для w125.ru: нижняя панель «Выбрать даты» (.mbar) и cookie-плашка (#ck). Шрифты Onest и Unbounded уже подключены на сайте.</p>
        </Card>
      </fieldset>
      <Card title="Демонстрационные данные">
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Сбросить все настройки, тестовые заявки и чаты в этом браузере?
            <Button variant="danger" size="sm" onClick={() => (resetDemo(), setConfirmReset(false), location.reload())}>Да, сбросить</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Отмена</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-3.5 w-3.5" /> Сбросить демо
          </Button>
        )}
      </Card>
    </div>
  );
}
