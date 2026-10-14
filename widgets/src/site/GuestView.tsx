import { DoorOpen, Monitor, RotateCcw, Smartphone, UserRoundCheck, UserRoundPlus } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { resetVisitor, set, useApp } from '../core/store';
import { cx, fmtTime } from '../core/util';
import { Demo, Segmented, Toggle } from '../ui/kit';
import { EXIT_EVENT, WidgetHost } from '../widgets/WidgetHost';
import { HostCtx, type HostEnv } from '../widgets/shared';
import { DemoSite } from './DemoSite';

const PRESETS = [
  { id: 'direct', label: 'Прямой заход', utm: {}, referrer: '' },
  { id: 'search', label: 'Яндекс поиск', utm: {}, referrer: 'https://yandex.ru/search' },
  { id: 'direct-ad', label: 'Директ: апартаменты', utm: { utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: 'apart_moscow' }, referrer: 'https://yandex.ru' },
  { id: 'corp', label: 'Корпоративная РК', utm: { utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: 'corp_b2b' }, referrer: 'https://yandex.ru' },
  { id: 'family', label: 'ВК: семьи', utm: { utm_source: 'vk', utm_medium: 'cpc', utm_campaign: 'family_vk' }, referrer: 'https://vk.com' },
] as const;

export function GuestView() {
  const frame = useApp((s) => s.sim.frame);
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
  const scroller = useRef<HTMLDivElement>(null);
  const host = useMemo<HostEnv>(() => ({ scrollEl: () => scroller.current, embedded: false }), []);

  const onLeave = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientY <= r.top + 4) window.dispatchEvent(new Event(EXIT_EVENT));
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 justify-center">
        <div
          onMouseLeave={onLeave}
          className={cx(
            'relative overflow-hidden border border-paper-line bg-white shadow-card',
            phone
              ? 'h-[calc(100dvh-170px)] min-h-[520px] w-full rounded-2xl'
              : frame === 'mobile'
                ? 'h-[760px] max-h-[calc(100vh-150px)] w-[390px] max-w-full rounded-[36px] border-[10px] border-ink'
                : 'h-[calc(100vh-150px)] min-h-[560px] w-full rounded-2xl',
          )}
          style={{ transform: 'translateZ(0)' }}
        >
          <div ref={scroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            <DemoSite />
          </div>
          <HostCtx.Provider value={host}>
            <WidgetHost />
          </HostCtx.Provider>
        </div>
      </div>
      <Simulator />
    </div>
  );
}

function Simulator() {
  const sim = useApp((s) => s.sim);
  const visitor = useApp((s) => s.visitor);
  const events = useApp((s) => s.events);
  const activePreset = PRESETS.find((p) => JSON.stringify(p.utm) === JSON.stringify(visitor.utm) && p.referrer === visitor.referrer)?.id;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
      <div className="rounded-2xl border border-paper-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Симулятор посетителя</h2>
          <Demo />
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <Segmented
            value={sim.frame}
            onChange={(v) => set((s) => ({ sim: { ...s.sim, frame: v }, visitor: { ...s.visitor, device: v } }))}
            options={[
              { value: 'desktop', label: <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Компьютер</span> },
              { value: 'mobile', label: <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Телефон</span> },
            ]}
          />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">Источник трафика</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set((s) => ({ visitor: { ...s.visitor, utm: { ...p.utm }, referrer: p.referrer } }))}
                  className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold', activePreset === p.id ? 'border-ink bg-ink text-white' : 'border-paper-line hover:border-ink/30')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => resetVisitor(false)} className="flex items-center justify-center gap-1.5 rounded-xl border border-paper-line py-2 text-xs font-semibold hover:border-ink/30">
              <UserRoundPlus className="h-3.5 w-3.5" /> Новый визит
            </button>
            <button onClick={() => resetVisitor(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-paper-line py-2 text-xs font-semibold hover:border-ink/30">
              <UserRoundCheck className="h-3.5 w-3.5" /> Повторный визит
            </button>
            <button onClick={() => window.dispatchEvent(new Event(EXIT_EVENT))} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-paper-sunk py-2 text-xs font-semibold hover:bg-paper-line">
              <DoorOpen className="h-3.5 w-3.5" /> Симулировать уход с сайта
            </button>
            <button
              onClick={() => set((s) => ({ visitor: { ...s.visitor, shown: {}, leadSubmitted: false } }))}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-sunk"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Сбросить ограничения частоты показов
            </button>
          </div>
          <Toggle
            checked={sim.bnovoDemo}
            onChange={(v) => set((s) => ({ sim: { ...s.sim, bnovoDemo: v } }))}
            label={<span className="text-xs">DEMO-данные Bnovo (наличие, цены, факты для уведомлений)</span>}
          />
          <p className="text-[11px] leading-snug text-ink-mute">
            Визит №{visitor.visits} · действия: {visitor.actions.join(', ') || 'нет'}
            {visitor.leadSubmitted && ' · заявка отправлена (попапы больше не показываются)'}
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-paper-line bg-white">
        <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
          <h2 className="text-sm font-bold">События → цели Метрики</h2>
          <span className="text-[11px] text-ink-mute">не отправляются: счётчик не подключён</span>
        </div>
        <ol className="max-h-[300px] flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] lg:max-h-none">
          {events.length === 0 && <li className="py-4 text-center font-sans text-xs text-ink-mute">Действуйте на сайте - события появятся здесь</li>}
          {events.slice(0, 60).map((e) => (
            <li key={e.id} className="flex gap-2 border-b border-paper-line/60 py-1.5 last:border-0">
              <span className="text-ink-mute">{fmtTime(e.at)}</span>
              <span className="min-w-0 break-all text-ink">{e.goal}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
