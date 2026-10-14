import { ArrowDown, ArrowUp, Lock, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { WIDGET_LABEL } from '../core/defaults';
import { getProofSignals } from '../core/integrations';
import { patchWidget, useApp } from '../core/store';
import type { Config, MobileMode, WidgetId } from '../core/types';
import { cx } from '../core/util';
import { Badge, Card, Demo, Field, Input, PageHead, Segmented, Select, Textarea, Toggle } from '../ui/kit';
import { CallbackPanel } from '../widgets/Callback';
import { ChatPanel } from '../widgets/Chat';
import { LeadPopup } from '../widgets/LeadPopup';
import { MultiButton } from '../widgets/MultiButton';
import { QuizPanel } from '../widgets/Quiz';
import { ProofToast } from '../widgets/SocialProof';
import { VideoBubble } from '../widgets/Video';
import { useBrandVars } from '../widgets/WidgetHost';
import { useCan } from './AdminApp';

const ORDER: WidgetId[] = ['callback', 'chat', 'multibutton', 'socialProof', 'leadPopup', 'quiz', 'personalization', 'video'];
const DESCR: Record<WidgetId, string> = {
  callback: 'Плавающая кнопка и форма заказа звонка',
  chat: 'Виртуальный консультант и передача администратору',
  multibutton: 'Все каналы связи в одной кнопке',
  socialProof: 'Уведомления только по фактам Bnovo',
  leadPopup: 'Окна по поведению посетителя',
  quiz: 'Пошаговый подбор апартаментов',
  personalization: 'Тексты под сегмент посетителя',
  video: 'Видеоэкскурсия с CTA',
};

export function WidgetsPage() {
  const [sel, setSel] = useState<WidgetId>('callback');
  const widgets = useApp((s) => s.config.widgets);
  const can = useCan('widgets');
  const mbOn = widgets.multibutton.enabled;

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Виджеты" sub="Включайте, настраивайте тексты, цвета, задержки и условия показа. Изменения применяются на «Сайте гостя» сразу." />
      {!can && (
        <p className="flex items-center gap-2 rounded-xl bg-paper-sunk px-4 py-2 text-sm text-ink-soft">
          <Lock className="h-4 w-4" /> У вашей роли доступ только на просмотр.
        </p>
      )}
      {mbOn && (widgets.callback.showLauncher || widgets.chat.showLauncher) && (
        <p className="rounded-xl bg-sage-soft px-4 py-2 text-xs text-sage">
          Мультикнопка включена - отдельные кнопки звонка и чата скрыты автоматически, чтобы на сайте была одна плавающая кнопка. Форма звонка и чат открываются из мультикнопки.
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((id) => (
          <button
            key={id}
            onClick={() => setSel(id)}
            className={cx('flex items-start justify-between gap-3 rounded-2xl border bg-white p-3.5 text-left transition', sel === id ? 'border-ink ring-1 ring-ink' : 'border-paper-line hover:border-ink/30')}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">{WIDGET_LABEL[id]}</span>
              <span className="block text-xs text-ink-mute">{DESCR[id]}</span>
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle checked={widgets[id].enabled} disabled={!can} onChange={(v) => patchWidget(id, { enabled: v } as never)} />
            </span>
          </button>
        ))}
      </div>
      <Editor id={sel} can={can} />
    </div>
  );
}

function Editor({ id, can }: { id: WidgetId; can: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const vars = useBrandVars();
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card title={`Настройки: ${WIDGET_LABEL[id]}`}>
        <fieldset disabled={!can} className="flex flex-col gap-4">
          {id === 'callback' && <CallbackForm />}
          {id === 'chat' && <ChatForm />}
          {id === 'multibutton' && <MultiForm />}
          {id === 'socialProof' && <ProofForm />}
          {id === 'leadPopup' && <PopupForm />}
          {id === 'quiz' && <QuizForm />}
          {id === 'personalization' && <PersForm />}
          {id === 'video' && <VideoForm />}
          <CommonForm id={id} />
        </fieldset>
      </Card>
      <Card
        title="Предпросмотр"
        actions={
          <Segmented
            value={device}
            onChange={setDevice}
            options={[
              { value: 'desktop', label: 'Компьютер' },
              { value: 'mobile', label: 'Телефон' },
            ]}
          />
        }
      >
        <div
          className={cx('relative mx-auto flex min-h-[460px] items-end justify-center overflow-hidden rounded-xl bg-[repeating-linear-gradient(45deg,#f4f5f2,#f4f5f2_12px,#eef0ec_12px,#eef0ec_24px)] p-4', device === 'mobile' ? 'max-w-[390px]' : 'w-full')}
          style={vars}
        >
          <Preview id={id} />
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">Предпросмотр не создаёт заявок и не пишет события в аналитику.</p>
      </Card>
    </div>
  );
}

function Preview({ id }: { id: WidgetId }) {
  const popup = useApp((s) => s.config.widgets.leadPopup.scenarios[0]);
  const pers = useApp((s) => s.config.widgets.personalization);
  const signals = useApp(() => getProofSignals());
  switch (id) {
    case 'callback':
      return <CallbackPanel preview />;
    case 'chat':
      return <ChatPanel preview />;
    case 'multibutton':
      return (
        <div className="flex w-full justify-end">
          <MultiButton preview forceOpen />
        </div>
      );
    case 'socialProof':
      return signals.length ? (
        <div className="flex w-full flex-col items-start gap-2">
          {signals.map((s) => (
            <ProofToast key={s.id} signal={s} />
          ))}
        </div>
      ) : (
        <div className="m-auto max-w-sm rounded-xl bg-white p-4 text-center text-sm text-ink-soft">
          Нет подтверждённых данных Bnovo - уведомления не показываются. Включите DEMO-данные Bnovo в симуляторе на «Сайте гостя», чтобы увидеть пример.
        </div>
      );
    case 'leadPopup':
      return <div className="m-auto w-full"><LeadPopup preview popup={{ scenarioId: popup.id, title: popup.title, text: popup.text, button: popup.button }} /></div>;
    case 'quiz':
      return <div className="max-h-[520px] w-full"><QuizPanel preview /></div>;
    case 'personalization':
      return (
        <div className="m-auto flex w-full flex-col gap-3 rounded-2xl bg-white p-6">
          <p className="text-[11px] font-semibold text-ink-mute">По умолчанию (без сегмента)</p>
          <p className="font-display text-3xl leading-tight">{pers.defaultHeadline}</p>
          <p className="text-sm text-ink-soft">{pers.defaultSubline}</p>
          <span className="w-fit rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">{pers.defaultCta}</span>
        </div>
      );
    case 'video':
      return (
        <div className="flex w-full justify-start">
          <VideoBubble preview />
        </div>
      );
  }
}

// ---------- формы ----------

function useW<K extends keyof Config['widgets']>(id: K) {
  const w = useApp((s) => s.config.widgets[id]);
  return [w, (patch: Partial<Config['widgets'][K]>) => patchWidget(id, patch)] as const;
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function CommonForm({ id }: { id: WidgetId }) {
  const [w, set] = useW(id);
  return (
    <div className="flex flex-col gap-3 border-t border-paper-line pt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Где показывать</p>
      <Row>
        <Field label="Страницы" hint="* - все, или пути через запятую: /, /prices">
          <Input value={w.pages.include} onChange={(e) => set({ pages: { ...w.pages, include: e.target.value } } as never)} />
        </Field>
        <Field label="Кроме страниц" hint="Например: /booking, /contacts">
          <Input value={w.pages.exclude} onChange={(e) => set({ pages: { ...w.pages, exclude: e.target.value } } as never)} />
        </Field>
      </Row>
      <Field label="На мобильных">
        <Select
          value={w.mobile}
          onChange={(e) => set({ mobile: e.target.value as MobileMode } as never)}
          options={[
            { value: 'show', label: 'Показывать полностью' },
            { value: 'compact', label: 'Компактно' },
            { value: 'hide', label: 'Не показывать' },
          ]}
        />
      </Field>
    </div>
  );
}

function CallbackForm() {
  const [w, set] = useW('callback');
  const hours = useApp((s) => s.config.hours);
  return (
    <>
      <Field label="Заголовок"><Input value={w.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Подзаголовок"><Textarea value={w.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <Row>
        <Field label="Текст кнопки"><Input value={w.button} onChange={(e) => set({ button: e.target.value })} /></Field>
        <Field label="Обещанное время ответа, мин" hint={`Показывается в рабочие часы (${hours.from}-${hours.to}). Сверяйте с фактом на «Главной».`}>
          <Input type="number" min={1} max={240} value={w.promiseMinutes} onChange={(e) => set({ promiseMinutes: Number(e.target.value) || 1 })} />
        </Field>
      </Row>
      <Toggle checked={w.allowSchedule} onChange={(v) => set({ allowSchedule: v })} label="Выбор удобного времени звонка" />
      <Toggle checked={w.showLauncher} onChange={(v) => set({ showLauncher: v })} label="Отдельная кнопка (если мультикнопка выключена)" />
    </>
  );
}

function ChatForm() {
  const [w, set] = useW('chat');
  return (
    <>
      <Toggle checked={w.aiEnabled} onChange={(v) => set({ aiEnabled: v })} label={<span>ИИ-консультант {w.aiEnabled ? <Badge tone="ok">включён</Badge> : <Badge tone="warn">выключен - отвечают люди</Badge>}</span>} />
      <Field label="Первое сообщение"><Textarea value={w.greeting} onChange={(e) => set({ greeting: e.target.value })} /></Field>
      <Field label="Быстрые действия" hint="Одно на строку">
        <Textarea rows={7} value={w.quickActions.join('\n')} onChange={(e) => set({ quickActions: e.target.value.split('\n').filter((x) => x.trim()) })} />
      </Field>
      <Field label="Имя оператора в чате"><Input value={w.operatorName} onChange={(e) => set({ operatorName: e.target.value })} /></Field>
      <Toggle checked={w.showLauncher} onChange={(v) => set({ showLauncher: v })} label="Отдельная кнопка (если мультикнопка выключена)" />
      <p className="text-xs text-ink-mute">База знаний для ответов - в разделе «Чаты» → «База знаний». Неподтверждённые записи в боевом режиме не используются.</p>
    </>
  );
}

const COLORS = ['#2f3a36', '#23262b', '#5e7a6b', '#6b5a4a', '#33506b'];

function MultiForm() {
  const [w, set] = useW('multibutton');
  const move = (i: number, d: number) => {
    const items = [...w.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  };
  return (
    <>
      <Row>
        <Field label="Положение">
          <Select value={w.position} onChange={(e) => set({ position: e.target.value as 'left' | 'right' })} options={[{ value: 'right', label: 'Справа' }, { value: 'left', label: 'Слева' }]} />
        </Field>
        <Field label="Анимация раскрытия">
          <Select value={w.animation} onChange={(e) => set({ animation: e.target.value as 'fan' | 'slide' })} options={[{ value: 'fan', label: 'Появление' }, { value: 'slide', label: 'Выезд' }]} />
        </Field>
      </Row>
      <Field label="Цвет">
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={`Цвет ${c}`} className={cx('h-8 w-8 rounded-full ring-offset-2', w.color === c && 'ring-2 ring-ink')} style={{ background: c }} />
          ))}
          <input type="color" value={w.color} onChange={(e) => set({ color: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-paper-line" aria-label="Свой цвет" />
        </div>
      </Field>
      <Toggle checked={w.pulse} onChange={(v) => set({ pulse: v })} label="Мягкая пульсация кнопки" />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-soft">Пункты меню (ссылки и телефоны - в «Настройках»)</p>
        {w.items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-2">
            <Toggle checked={it.enabled} onChange={(v) => set({ items: w.items.map((x) => (x.id === it.id ? { ...x, enabled: v } : x)) })} />
            <Input value={it.label} onChange={(e) => set({ items: w.items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)) })} />
            <button type="button" onClick={() => move(i, -1)} className="rounded-lg p-1.5 hover:bg-paper-sunk" aria-label="Выше"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => move(i, 1)} className="rounded-lg p-1.5 hover:bg-paper-sunk" aria-label="Ниже"><ArrowDown className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </>
  );
}

function ProofForm() {
  const [w, set] = useW('socialProof');
  const signals = useApp(() => getProofSignals());
  return (
    <>
      <div className="rounded-xl bg-paper p-3 text-xs text-ink-soft">
        <p className="mb-1 font-bold text-ink">Источник утверждений</p>
        {signals.length ? (
          <ul className="flex flex-col gap-1">
            {signals.map((s) => (
              <li key={s.id}>
                «{s.text}» ← {s.basis} {s.demo && <Demo />}
              </li>
            ))}
          </ul>
        ) : (
          <p>Bnovo не подключён → уведомлений нет. Фиктивные брони, выдуманные гости и искусственная срочность не генерируются.</p>
        )}
      </div>
      <Row>
        <Field label="Первое уведомление через, сек"><Input type="number" min={0} value={w.firstDelaySec} onChange={(e) => set({ firstDelaySec: Number(e.target.value) })} /></Field>
        <Field label="Интервал между уведомлениями, сек"><Input type="number" min={5} value={w.intervalSec} onChange={(e) => set({ intervalSec: Number(e.target.value) })} /></Field>
        <Field label="Максимум за визит"><Input type="number" min={1} max={10} value={w.maxPerSession} onChange={(e) => set({ maxPerSession: Number(e.target.value) })} /></Field>
        <Field label="Длительность показа, сек"><Input type="number" min={3} value={w.displaySec} onChange={(e) => set({ displaySec: Number(e.target.value) })} /></Field>
      </Row>
      <Field label="Положение">
        <Select value={w.position} onChange={(e) => set({ position: e.target.value as 'left' | 'right' })} options={[{ value: 'left', label: 'Слева внизу' }, { value: 'right', label: 'Справа внизу' }]} />
      </Field>
      <Toggle checked={w.hideForReturning} onChange={(v) => set({ hideForReturning: v })} label="Не показывать повторным посетителям" />
    </>
  );
}

function readFile(f: File, max: number): Promise<string> {
  return new Promise((res, rej) => {
    if (f.size > max) return rej(new Error(`Файл больше ${Math.round(max / 1024 / 1024)} МБ`));
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(f);
  });
}

function PopupForm() {
  const [w, set] = useW('leadPopup');
  const [err, setErr] = useState('');
  return (
    <>
      <Row>
        <Field label="Не раньше чем через, сек на сайте"><Input type="number" min={0} value={w.minSecondsOnSite} onChange={(e) => set({ minSecondsOnSite: Number(e.target.value) })} /></Field>
        <Field label="Максимум окон за визит"><Input type="number" min={1} max={5} value={w.maxPerSession} onChange={(e) => set({ maxPerSession: Number(e.target.value) })} /></Field>
      </Row>
      <Field label="Изображение в окне" hint="JPG/PNG/WebP до 1 МБ. В прототипе хранится в браузере.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-paper-line px-3 text-sm font-semibold hover:border-ink/30">
            <Upload className="h-4 w-4" /> Загрузить
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], 1024 * 1024).then((d) => (set({ image: d }), setErr(''))).catch((x) => setErr(x.message))} />
          </label>
          {w.image && <button type="button" onClick={() => set({ image: '' })} className="text-xs font-semibold text-bad">Убрать</button>}
          {err && <span className="text-xs text-bad">{err}</span>}
        </div>
      </Field>
      <p className="text-xs text-ink-mute">Тексты, триггеры и частота каждого окна - в разделе «Сценарии». После отправки заявки окна посетителю больше не показываются.</p>
    </>
  );
}

function QuizForm() {
  const [w, set] = useW('quiz');
  return (
    <>
      <Field label="Заголовок"><Input value={w.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Текст кнопки запуска"><Input value={w.launcherText} onChange={(e) => set({ launcherText: e.target.value })} /></Field>
      <Toggle checked={w.showInlineOnHome} onChange={(v) => set({ showInlineOnHome: v })} label="Блок квиза на главной" />
      <p className="text-xs text-ink-mute">Шаг 5 показывает варианты из Bnovo, если интеграция подключена; иначе - заявку на индивидуальный подбор без цен. Прогресс сохраняется - гость может продолжить позже.</p>
    </>
  );
}

function PersForm() {
  const [w, set] = useW('personalization');
  return (
    <>
      <Field label="Заголовок по умолчанию"><Input value={w.defaultHeadline} onChange={(e) => set({ defaultHeadline: e.target.value })} /></Field>
      <Field label="Подзаголовок по умолчанию"><Textarea value={w.defaultSubline} onChange={(e) => set({ defaultSubline: e.target.value })} /></Field>
      <Field label="Кнопка по умолчанию"><Input value={w.defaultCta} onChange={(e) => set({ defaultCta: e.target.value })} /></Field>
      <p className="text-xs text-ink-mute">Сегменты, условия, приоритеты и тексты для каждого сегмента - в разделе «Сценарии» → «Сегменты».</p>
    </>
  );
}

function VideoForm() {
  const [w, set] = useW('video');
  const [err, setErr] = useState('');
  return (
    <>
      <Field label="Видео" hint="MP4/WebM до 15 МБ. В прототипе живёт до перезагрузки страницы; в проде загружается в хранилище (S3) и отдаётся через CDN.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-paper-line px-3 text-sm font-semibold hover:border-ink/30">
            <Upload className="h-4 w-4" /> Загрузить видео
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 15 * 1024 * 1024) return setErr('Файл больше 15 МБ');
                setErr('');
                set({ src: URL.createObjectURL(f) });
              }}
            />
          </label>
          {w.src ? <button type="button" onClick={() => set({ src: '' })} className="text-xs font-semibold text-bad">Вернуть демо-ролик</button> : <Demo>слайд-шоу из фото сайта</Demo>}
          {err && <span className="text-xs text-bad">{err}</span>}
        </div>
      </Field>
      <Field label="Подпись"><Input value={w.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Row>
        <Field label="CTA 1"><Input value={w.ctaPrimary} onChange={(e) => set({ ctaPrimary: e.target.value })} /></Field>
        <Field label="Куда ведёт CTA 1" hint="Путь или якорь на сайте, например #rooms"><Input value={w.ctaPrimaryHref} onChange={(e) => set({ ctaPrimaryHref: e.target.value })} /></Field>
        <Field label="CTA 2 (бронирование)"><Input value={w.ctaSecondary} onChange={(e) => set({ ctaSecondary: e.target.value })} /></Field>
        <Field label="Размер">
          <Select value={w.size} onChange={(e) => set({ size: e.target.value as 's' | 'm' | 'l' })} options={[{ value: 's', label: 'Маленький' }, { value: 'm', label: 'Средний' }, { value: 'l', label: 'Большой' }]} />
        </Field>
        <Field label="Положение">
          <Select value={w.position} onChange={(e) => set({ position: e.target.value as 'left' | 'right' })} options={[{ value: 'left', label: 'Слева внизу' }, { value: 'right', label: 'Справа внизу' }]} />
        </Field>
        <Field label="Задержка появления, сек"><Input type="number" min={0} value={w.delaySec} onChange={(e) => set({ delaySec: Number(e.target.value) })} /></Field>
      </Row>
    </>
  );
}
