import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { WIDGET_LABEL, SOURCE_LABEL } from '../core/defaults';
import { computeMetrics, defaultFilters, FORMULAS } from '../core/metrics';
import { useApp } from '../core/store';
import type { WidgetId } from '../core/types';
import { cx, minutesAgo, money, num, pct } from '../core/util';
import { Funnel, LineChart, SERIES, Spark } from '../ui/charts';
import { Badge, Card, Demo, Formula, PageHead } from '../ui/kit';
import type { Section } from './AdminApp';

export function Kpi({ label, value, formula, spark, note, tone }: { label: string; value: string; formula?: string; spark?: number[]; note?: string; tone?: 'bad' | 'ok' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-paper-line bg-white p-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        {label} {formula && <Formula text={formula} />}
      </span>
      <span className={cx('text-2xl font-extrabold tabular-nums tracking-tight', tone === 'bad' ? 'text-bad' : 'text-ink')}>{value}</span>
      {note && <span className="text-[11px] text-ink-mute">{note}</span>}
      {spark && <Spark values={spark} />}
    </div>
  );
}

export function Dashboard({ go }: { go: (s: Section) => void }) {
  const leads = useApp((s) => s.leads);
  const config = useApp((s) => s.config);
  const role = useApp((s) => s.role);
  const userId = useApp((s) => s.userId);
  const sla = config.reminders.firstAfterMin;
  const m = useMemo(() => computeMetrics(defaultFilters(30), leads, sla), [leads, sla]);
  const promise = config.widgets.callback.promiseMinutes;

  const queue = leads
    .filter((l) => l.status === 'new' && (role !== 'manager' || l.managerId === userId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Обзор эффективности"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Demo /> Последние 30 дней. Исторические цифры синтетические, ваши тестовые заявки добавляются к ним.
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Посетители" value={num(m.marketing.visitors)} formula={FORMULAS.visitors} spark={m.byDay.map((d) => d.visitors)} />
        <Kpi label="Обращения" value={num(m.sales.requests)} formula={FORMULAS.requests} spark={m.byDay.map((d) => d.requests)} />
        <Kpi label="Уникальные лиды" value={num(m.sales.uniqueLeads)} formula={FORMULAS.uniqueLeads} note={`дублей: ${m.sales.requests - m.sales.uniqueLeads}`} />
        <Kpi label="Подтверждённые брони" value={num(m.sales.bookings)} formula={FORMULAS.bookings} spark={m.byDay.map((d) => d.bookings)} />
        <Kpi label="Выручка (подтв.)" value={money(m.sales.revenue)} formula={FORMULAS.revenue} />
        <Kpi label="Конверсия лид → бронь" value={pct(m.sales.leadToBooking)} formula={FORMULAS.leadToBooking} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Обращения и брони по дням" actions={<Demo />}>
          <LineChart
            labels={m.byDay.map((d) => d.day.slice(8) + '.' + d.day.slice(5, 7))}
            series={[
              { name: 'Обращения', color: SERIES[0], values: m.byDay.map((d) => d.requests) },
              { name: 'Подтверждённые брони', color: SERIES[1], values: m.byDay.map((d) => d.bookings) },
            ]}
          />
        </Card>
        <Card title="Воронка: от визита до брони" actions={<Demo />}>
          <Funnel
            steps={[
              { label: 'Видели виджет', value: m.marketing.uniqImpr },
              { label: 'Открыли', value: m.marketing.uniqOpens },
              { label: 'Начали заполнять', value: m.marketing.starts },
              { label: 'Обращения', value: m.sales.requests },
              { label: 'Уникальные лиды', value: m.sales.uniqueLeads },
              { label: 'Подтв. брони', value: m.sales.bookings },
            ]}
          />
          <p className="mt-3 text-[11px] text-ink-mute">Процент - конверсия из предыдущего шага. «Видели виджет» суммируется по виджетам: один посетитель может видеть несколько.</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          title={role === 'manager' ? 'Мои необработанные заявки' : 'Ждут первого ответа'}
          actions={
            <button onClick={() => go('leads')} className="inline-flex items-center gap-1 text-xs font-semibold text-sage">
              Все заявки <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        >
          {queue.length === 0 ? (
            <p className="text-sm text-ink-mute">Очередь пуста.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.map((l) => {
                const age = minutesAgo(l.createdAt);
                const late = age > sla;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      #{l.num} · {SOURCE_LABEL[l.source]} {l.demo && l.id.startsWith('demo') && <Demo className="ml-1" />}
                    </span>
                    <Badge tone={late ? 'bad' : 'warn'}>
                      <Clock className="h-3 w-3" /> {age > 120 ? `${Math.round(age / 60)} ч` : `${age} мин`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Скорость ответа против обещания">
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-paper p-2">
                <p className="text-[11px] text-ink-mute">Обещаем</p>
                <p className="text-lg font-bold tabular-nums">{promise} мин</p>
              </div>
              <div className="rounded-xl bg-paper p-2">
                <p className="text-[11px] text-ink-mute">Медиана</p>
                <p className="text-lg font-bold tabular-nums">{isFinite(m.sales.medResp) ? Math.round(m.sales.medResp) : '-'} мин</p>
              </div>
              <div className="rounded-xl bg-paper p-2">
                <p className="text-[11px] text-ink-mute">80% заявок</p>
                <p className="text-lg font-bold tabular-nums">{isFinite(m.sales.p80Resp) ? Math.round(m.sales.p80Resp) : '-'} мин</p>
              </div>
            </div>
            {m.sales.p80Resp > promise ? (
              <p className="flex gap-2 rounded-xl bg-warn/10 p-3 text-xs text-warn">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Каждый пятый гость ждёт дольше, чем обещает виджет. Увеличьте обещанное время в настройках обратного звонка или усильте смену.
              </p>
            ) : (
              <p className="text-xs text-ok">Обещание выполняется для 80% заявок.</p>
            )}
            <p className="text-[11px] text-ink-mute">Учтены все заявки за период, включая ночные: линия работает 24/7, обещание одно - 10 минут. <Demo /></p>
          </div>
        </Card>

        <Card title="Виджеты" actions={<button onClick={() => go('widgets')} className="text-xs font-semibold text-sage">Настроить</button>}>
          <ul className="flex flex-col gap-1.5 text-sm">
            {(Object.keys(config.widgets) as WidgetId[]).map((w) => {
              const pw = m.perWidget.find((x) => x.widget === w);
              return (
                <li key={w} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={cx('h-2 w-2 rounded-full', config.widgets[w].enabled ? 'bg-ok' : 'bg-ink-mute/40')} />
                    {WIDGET_LABEL[w]}
                  </span>
                  <span className="text-xs tabular-nums text-ink-soft">{pw ? `${num(pw.requests)} обращ.` : ''}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
