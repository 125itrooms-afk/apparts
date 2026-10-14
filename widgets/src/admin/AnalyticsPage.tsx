import { useMemo, useState } from 'react';
import { WIDGET_LABEL } from '../core/defaults';
import { CHANNELS, TRACKED_WIDGETS } from '../core/demoData';
import { computeMetrics, defaultFilters, FORMULAS, type Filters } from '../core/metrics';
import { useApp } from '../core/store';
import type { WidgetId } from '../core/types';
import { cx, money, num, pct } from '../core/util';
import { BarList, LineChart, SERIES } from '../ui/charts';
import { Card, Demo, Formula, PageHead, Segmented } from '../ui/kit';
import { Kpi } from './Dashboard';

function MultiSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cx('h-9 rounded-lg border px-3 text-xs font-semibold', value.length ? 'border-ink bg-ink text-white' : 'border-paper-line bg-white text-ink')}
        aria-expanded={open}
      >
        {label}
        {value.length ? `: ${value.length}` : ''}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 w-60 rounded-xl border border-paper-line bg-white p-2 shadow-float">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
              <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
              {o.label}
            </label>
          ))}
          <div className="mt-1 flex justify-between border-t border-paper-line px-2 pt-2">
            <button className="text-xs text-ink-soft" onClick={() => onChange([])}>Сбросить</button>
            <button className="text-xs font-semibold" onClick={() => setOpen(false)}>Готово</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const leads = useApp((s) => s.leads);
  const staff = useApp((s) => s.staff);
  const sla = useApp((s) => s.config.reminders.firstAfterMin);
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [f, setF] = useState<Filters>(defaultFilters(30));
  const [tab, setTab] = useState<'mkt' | 'sales' | 'team'>('mkt');
  const m = useMemo(() => computeMetrics(f, leads, sla), [f, leads, sla]);
  const mName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const sources = [...new Set(CHANNELS.map((c) => c.source))];
  const campaigns = [...new Set(CHANNELS.map((c) => c.campaign))];
  const labels = m.byDay.map((d) => d.day.slice(8) + '.' + d.day.slice(5, 7));

  const setPeriodDays = (p: '7' | '30' | '90' | 'custom') => {
    setPeriod(p);
    if (p !== 'custom') setF({ ...f, ...(({ from, to }) => ({ from, to }))(defaultFilters(Number(p))) });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Аналитика"
        sub={<span>Все показатели считаются по формулам (значок ⓘ). Обращения, лиды, бронирования и заезды - разные сущности. <Demo /></span>}
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'mkt', label: 'Маркетинг' }, { value: 'sales', label: 'Продажи' }, { value: 'team', label: 'Отдел бронирования' }]} />}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-paper-line bg-white p-3">
        <Segmented value={period} onChange={setPeriodDays} options={[{ value: '7', label: '7 дней' }, { value: '30', label: '30 дней' }, { value: '90', label: '90 дней' }, { value: 'custom', label: 'Период' }]} />
        {period === 'custom' && (
          <span className="flex items-center gap-1 text-xs">
            <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="h-9 rounded-lg border border-paper-line px-2" aria-label="С" />
            -
            <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-9 rounded-lg border border-paper-line px-2" aria-label="По" />
          </span>
        )}
        <MultiSelect label="Каналы" options={sources.map((s) => ({ value: s, label: s }))} value={f.sources} onChange={(v) => setF({ ...f, sources: v })} />
        <MultiSelect label="Кампании" options={campaigns.map((s) => ({ value: s, label: s }))} value={f.campaigns} onChange={(v) => setF({ ...f, campaigns: v })} />
        <MultiSelect label="Виджеты" options={TRACKED_WIDGETS.map((w) => ({ value: w, label: WIDGET_LABEL[w] }))} value={f.widgets} onChange={(v) => setF({ ...f, widgets: v as WidgetId[] })} />
        <MultiSelect label="Менеджеры" options={staff.filter((s) => s.role === 'manager').map((s) => ({ value: s.id, label: s.name }))} value={f.managers} onChange={(v) => setF({ ...f, managers: v })} />
        <MultiSelect label="Устройства" options={[{ value: 'desktop', label: 'Компьютер' }, { value: 'mobile', label: 'Телефон' }]} value={f.devices} onChange={(v) => setF({ ...f, devices: v as ('desktop' | 'mobile')[] })} />
        {f.managers.length > 0 && tab === 'mkt' && <span className="text-[11px] text-ink-mute">Фильтр по менеджеру влияет только на заявки, не на трафик.</span>}
      </div>

      {tab === 'mkt' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Посетители" value={num(m.marketing.visitors)} formula={FORMULAS.visitors} />
            <Kpi label="Показы виджетов" value={num(m.marketing.impressions)} formula={FORMULAS.impressions} />
            <Kpi label="Уникальные открытия" value={num(m.marketing.uniqOpens)} formula={FORMULAS.uniqOpens} />
            <Kpi label="CTR" value={pct(m.marketing.ctr)} formula={FORMULAS.ctr} />
            <Kpi label="Открытие → заявка" value={pct(m.marketing.openToLead)} formula={FORMULAS.openToLead} />
            <Kpi label="Стоимость заявки" value={isFinite(m.marketing.cpl) ? money(m.marketing.cpl) : '-'} formula={FORMULAS.cpl} note={`расходы ${money(m.marketing.spend)}`} />
          </div>
          <Card title="Посетители по дням">
            <LineChart labels={labels} series={[{ name: 'Посетители', color: SERIES[0], values: m.byDay.map((d) => d.visitors) }]} height={180} />
          </Card>
          <Card title="Виджеты">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm tabular-nums">
                <thead className="text-left text-xs text-ink-mute">
                  <tr>
                    <th className="py-2 font-semibold">Виджет</th>
                    <th className="py-2 font-semibold">Показы</th>
                    <th className="py-2 font-semibold">Уник. показы</th>
                    <th className="py-2 font-semibold">Уник. открытия</th>
                    <th className="py-2 font-semibold"><span className="inline-flex items-center gap-1">CTR <Formula text={FORMULAS.ctr} /></span></th>
                    <th className="py-2 font-semibold">Начали</th>
                    <th className="py-2 font-semibold">Обращения</th>
                    <th className="py-2 font-semibold"><span className="inline-flex items-center gap-1">Откр. → заявка <Formula text={FORMULAS.openToLead} /></span></th>
                    <th className="py-2 font-semibold">В бронирование</th>
                    <th className="py-2 font-semibold">Подтв. брони</th>
                  </tr>
                </thead>
                <tbody>
                  {m.perWidget.map((w) => (
                    <tr key={w.widget} className="border-t border-paper-line">
                      <td className="py-2 font-sans font-semibold">{WIDGET_LABEL[w.widget]}</td>
                      <td className="py-2">{num(w.impressions)}</td>
                      <td className="py-2">{num(w.uniqImpr)}</td>
                      <td className="py-2">{num(w.uniqOpens)}</td>
                      <td className="py-2">{pct(w.ctr)}</td>
                      <td className="py-2">{num(w.starts)}</td>
                      <td className="py-2">{num(w.requests)}</td>
                      <td className="py-2">{w.uniqOpens ? pct(w.openToLead) : '-'}</td>
                      <td className="py-2">{num(w.bookingClicks)}</td>
                      <td className="py-2">{num(w.bookings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-mute">«В бронирование» - переходы в модуль Bnovo. Это клик, а не бронь: брони считаются только по данным Bnovo.</p>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Источники трафика">
              <BarList rows={m.bySource.map((s) => ({ label: s.source, value: s.visitors, sub: `${num(s.requests)} обращ. · ${num(s.bookings)} брон.` }))} format={num} />
            </Card>
            <Card title="UTM-кампании">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm tabular-nums">
                  <thead className="text-left text-xs text-ink-mute">
                    <tr>
                      <th className="py-2 font-semibold">Кампания</th>
                      <th className="py-2 font-semibold">Расход</th>
                      <th className="py-2 font-semibold">Обращ.</th>
                      <th className="py-2 font-semibold">CPL</th>
                      <th className="py-2 font-semibold">Брони</th>
                      <th className="py-2 font-semibold">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.byCampaign.map((c) => (
                      <tr key={c.campaign} className="border-t border-paper-line">
                        <td className="py-2 font-sans"><span className="font-semibold">{c.campaign}</span> <span className="text-xs text-ink-mute">{c.source}</span></td>
                        <td className="py-2">{money(c.spend)}</td>
                        <td className="py-2">{c.requests}</td>
                        <td className="py-2">{c.requests ? money(c.spend / c.requests) : '-'}</td>
                        <td className="py-2">{c.bookings}</td>
                        <td className="py-2">{money(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-ink-mute">Выручка по кампании - только при атрибуции: бронь в Bnovo сопоставлена с лидом, у которого есть UTM.</p>
            </Card>
          </div>
        </>
      )}

      {tab === 'sales' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Обращения" value={num(m.sales.requests)} formula={FORMULAS.requests} />
            <Kpi label="Уникальные лиды" value={num(m.sales.uniqueLeads)} formula={FORMULAS.uniqueLeads} />
            <Kpi label="Дозвон" value={pct(m.sales.reachRate)} formula={FORMULAS.reachRate} />
            <Kpi label="Первый ответ, среднее" value={isFinite(m.sales.avgResp) ? `${Math.round(m.sales.avgResp)} мин` : '-'} formula={FORMULAS.firstResponse} note={`медиана ${isFinite(m.sales.medResp) ? Math.round(m.sales.medResp) : '-'} мин`} />
            <Kpi label="Пропущенные" value={num(m.sales.missed)} formula={FORMULAS.missed} tone={m.sales.missed ? 'bad' : undefined} note={`норматив ${sla} мин`} />
            <Kpi label="Лид → бронь" value={pct(m.sales.leadToBooking)} formula={FORMULAS.leadToBooking} />
            <Kpi label="Подтверждённые брони" value={num(m.sales.bookings)} formula={FORMULAS.bookings} />
            <Kpi label="Выручка (подтв.)" value={money(m.sales.revenue)} formula={FORMULAS.revenue} />
            <Kpi label="Средний чек" value={isFinite(m.sales.avgCheck) ? money(m.sales.avgCheck) : '-'} formula={FORMULAS.avgCheck} />
            <Kpi label="Доля прямых броней" value={pct(m.sales.directShare)} formula={FORMULAS.directShare} note={`из ${num(m.sales.allBookings)} броней в Bnovo`} />
          </div>
          <Card title="Обращения и подтверждённые брони">
            <LineChart
              labels={labels}
              series={[
                { name: 'Обращения', color: SERIES[0], values: m.byDay.map((d) => d.requests) },
                { name: 'Подтверждённые брони', color: SERIES[1], values: m.byDay.map((d) => d.bookings) },
              ]}
            />
          </Card>
          <Card title="Чем отличаются показатели">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Обращение', 'Любая отправленная форма или контакт. Один гость может оставить несколько.'],
                ['Лид', 'Уникальный контакт (телефон/e-mail). Повторы склеиваются, в Bitrix24 - защита от дублей.'],
                ['Бронирование', 'Бронь в Bnovo, сопоставленная с лидом и подтверждённая. Ручная отметка менеджера без Bnovo в выручку не идёт.'],
                ['Заезд', 'Гость фактически заселился (статус в Bnovo). Считается отдельно после подключения API.'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-paper p-3">
                  <dt className="font-bold">{k}</dt>
                  <dd className="mt-1 text-xs text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      )}

      {tab === 'team' && (
        <>
          <Card title="Менеджеры">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm tabular-nums">
                <thead className="text-left text-xs text-ink-mute">
                  <tr>
                    <th className="py-2 font-semibold">Менеджер</th>
                    <th className="py-2 font-semibold">Заявки</th>
                    <th className="py-2 font-semibold">Обработано</th>
                    <th className="py-2 font-semibold">Ср. время ответа</th>
                    <th className="py-2 font-semibold">Просрочено сейчас</th>
                    <th className="py-2 font-semibold">Брони</th>
                    <th className="py-2 font-semibold">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {m.byManager.map((r) => (
                    <tr key={r.managerId} className="border-t border-paper-line">
                      <td className="py-2 font-sans font-semibold">{mName(r.managerId)}</td>
                      <td className="py-2">{r.requests}</td>
                      <td className="py-2">{r.processed}</td>
                      <td className={cx('py-2', r.avgResp > sla && 'text-bad')}>{isFinite(r.avgResp) ? `${Math.round(r.avgResp)} мин` : '-'}</td>
                      <td className={cx('py-2', r.overdue > 0 && 'font-bold text-bad')}>{r.overdue}</td>
                      <td className="py-2">{r.bookings}</td>
                      <td className="py-2">{money(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Причины отказов">
              <BarList rows={m.refusals.map(([label, value]) => ({ label, value }))} color={SERIES[1]} />
            </Card>
            <Card title="Заявки по менеджерам">
              <BarList rows={m.byManager.map((r) => ({ label: mName(r.managerId), value: r.requests, sub: `брони ${r.bookings}` }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
