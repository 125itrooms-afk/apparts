import { demoDataset, type DemoLead, TRACKED_WIDGETS } from './demoData';
import type { Lead, WidgetId } from './types';
import { isoDate, phoneDigits } from './util';

export interface Filters {
  from: string;
  to: string;
  sources: string[];
  campaigns: string[];
  widgets: WidgetId[];
  managers: string[];
  devices: ('desktop' | 'mobile')[];
}

export function defaultFilters(days = 30): Filters {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: isoDate(from), to: isoDate(to), sources: [], campaigns: [], widgets: [], managers: [], devices: [] };
}

export function leadChannel(l: DemoLead): { source: string; campaign: string } {
  if (l.channel) return { source: l.channel, campaign: l.campaign ?? '(нет)' };
  const src = (l.utm.utm_source || '').toLowerCase();
  const camp = l.utm.utm_campaign || '(нет)';
  if (camp.includes('corp')) return { source: 'Корпоративная РК', campaign: camp };
  if (src.includes('vk')) return { source: 'ВКонтакте', campaign: camp };
  if (src.includes('yandex') && l.utm.utm_medium === 'cpc') return { source: 'Яндекс Директ', campaign: camp };
  if (src.includes('yandex')) return { source: 'Яндекс поиск', campaign: '(органика)' };
  return { source: 'Прямые заходы', campaign: '(нет)' };
}

const inList = <T,>(list: T[], v: T) => !list.length || list.includes(v);

/**
 * Определения (не смешиваем сущности):
 *  Обращение  - каждая отправленная форма/контакт из виджета.
 *  Лид        - уникальный контакт (нормализованный телефон/e-mail) за период.
 *  Бронирование - бронь в Bnovo, сопоставленная с лидом и подтверждённая.
 *  Заезд      - бронь, по которой гость фактически заселился (из Bnovo, в DEMO не считается).
 */
export const FORMULAS: Record<string, string> = {
  visitors: 'Сумма дневных уникальных посетителей (Метрика, визиты с уникальным ClientID за день)',
  impressions: 'Число показов виджета (событие *_view)',
  uniqOpens: 'Уникальные посетители, открывшие виджет (событие *_open)',
  ctr: 'Уникальные открытия ÷ уникальные посетители, видевшие виджет',
  openToLead: 'Обращения из виджета ÷ уникальные открытия виджета',
  cpl: 'Рекламные расходы ÷ обращения из платных каналов',
  requests: 'Количество отправленных обращений (каждая форма/контакт)',
  uniqueLeads: 'Число уникальных контактов (телефон/e-mail) среди обращений',
  reachRate: 'Обращения со статусом «Дозвонились», «Забронировано», «Отказ» ÷ обработанные обращения',
  firstResponse: 'Среднее (и медиана) времени от создания обращения до первого действия менеджера',
  missed: 'Обращения без первого ответа дольше норматива SLA или без ответа вовсе',
  leadToBooking: 'Лиды с подтверждённой бронью ÷ уникальные лиды',
  bookings: 'Брони Bnovo, сопоставленные с лидом (по телефону/e-mail/ID), статус «подтверждена»',
  revenue: 'Сумма подтверждённых броней, сопоставленных с лидами',
  avgCheck: 'Выручка ÷ подтверждённые бронирования',
  directShare: 'Подтверждённые прямые брони (виджеты/сайт) ÷ все подтверждённые брони в Bnovo за период',
};

export function analyticsLeads(storeLeads: Lead[]): DemoLead[] {
  const map = new Map<string, DemoLead>();
  demoDataset().leads.forEach((l) => map.set(l.id, l));
  storeLeads.forEach((l) => map.set(l.id, { ...(map.get(l.id) ?? {}), ...l }));
  return [...map.values()];
}

export function computeMetrics(f: Filters, storeLeads: Lead[], slaMin: number) {
  const ds = demoDataset();
  const inDay = (d: string) => d >= f.from && d <= f.to;
  const traffic = ds.traffic.filter(
    (t) => inDay(t.day) && inList(f.sources, t.source) && inList(f.campaigns, t.campaign) && inList(f.devices, t.device),
  );
  const wrows = ds.widgets.filter(
    (t) =>
      inDay(t.day) &&
      inList(f.sources, t.source) &&
      inList(f.campaigns, t.campaign) &&
      inList(f.devices, t.device) &&
      inList(f.widgets, t.widget),
  );
  const leads = analyticsLeads(storeLeads).filter((l) => {
    const day = isoDate(new Date(l.createdAt));
    const ch = leadChannel(l);
    return (
      inDay(day) &&
      inList(f.sources, ch.source) &&
      inList(f.campaigns, ch.campaign) &&
      inList(f.devices, l.device) &&
      inList(f.widgets, l.source as WidgetId) &&
      (!f.managers.length || (l.managerId && f.managers.includes(l.managerId)))
    );
  });

  const sum = <T,>(a: T[], fn: (x: T) => number) => a.reduce((s, x) => s + fn(x), 0);
  const visitors = sum(traffic, (t) => t.visitors);
  const spend = sum(traffic, (t) => t.spend);
  const impressions = sum(wrows, (w) => w.impressions);
  const uniqImpr = sum(wrows, (w) => w.uniqImpressions);
  const uniqOpens = sum(wrows, (w) => w.uniqOpens);
  const starts = sum(wrows, (w) => w.starts);
  const bookingClicks = sum(wrows, (w) => w.bookingClicks);

  const requests = leads.length;
  const key = (l: Lead) => (l.phone ? phoneDigits(l.phone) : l.email?.toLowerCase() || l.id);
  const uniqueKeys = new Set(leads.map(key));
  const uniqueLeads = uniqueKeys.size;
  const processed = leads.filter((l) => l.status !== 'new' && l.status !== 'in_progress');
  const reached = processed.filter((l) => ['reached', 'booked', 'rejected'].includes(l.status));
  const responded = leads.filter((l) => l.firstResponseAt);
  const respMins = responded.map((l) => (l.firstResponseAt! - l.createdAt) / 60000).sort((a, b) => a - b);
  const avgResp = respMins.length ? respMins.reduce((a, b) => a + b, 0) / respMins.length : NaN;
  const medResp = respMins.length ? respMins[Math.floor(respMins.length / 2)] : NaN;
  const p80Resp = respMins.length ? respMins[Math.floor(respMins.length * 0.8)] : NaN;
  const missed = leads.filter((l) =>
    l.firstResponseAt ? (l.firstResponseAt - l.createdAt) / 60000 > slaMin : Date.now() - l.createdAt > slaMin * 60000,
  );
  const confirmed = leads.filter((l) => l.booking?.confirmed);
  const bookedKeys = new Set(confirmed.map(key));
  const revenue = sum(confirmed, (l) => l.booking!.amount);
  const paidRequests = leads.filter((l) => ['Яндекс Директ', 'Корпоративная РК', 'ВКонтакте'].includes(leadChannel(l).source)).length;
  const ota = ds.bookingsAll.filter((b) => inDay(b.day));
  const allBookings = sum(ota, (b) => b.allBookings) + confirmed.filter((l) => !l.demo).length;

  // ряды по дням
  const days: string[] = [];
  for (let t = new Date(f.from).getTime(); t <= new Date(f.to).getTime(); t += 86400000) days.push(isoDate(new Date(t)));
  const byDay = days.map((d) => ({
    day: d,
    visitors: sum(traffic.filter((t) => t.day === d), (t) => t.visitors),
    requests: leads.filter((l) => isoDate(new Date(l.createdAt)) === d).length,
    bookings: leads.filter((l) => l.booking?.confirmed && isoDate(new Date(l.createdAt)) === d).length,
  }));

  const perWidget = TRACKED_WIDGETS.filter((w) => inList(f.widgets, w)).map((w) => {
    const rows = wrows.filter((r) => r.widget === w);
    const ls = leads.filter((l) => l.source === w);
    const ui = sum(rows, (r) => r.uniqImpressions);
    const uo = sum(rows, (r) => r.uniqOpens);
    return {
      widget: w,
      impressions: sum(rows, (r) => r.impressions),
      uniqImpr: ui,
      uniqOpens: uo,
      starts: sum(rows, (r) => r.starts),
      requests: ls.length,
      bookingClicks: sum(rows, (r) => r.bookingClicks),
      bookings: ls.filter((l) => l.booking?.confirmed).length,
      revenue: sum(ls.filter((l) => l.booking?.confirmed), (l) => l.booking!.amount),
      ctr: uo / ui,
      openToLead: ls.length / uo,
    };
  });

  const bySource = new Map<string, { visitors: number; spend: number; requests: number; bookings: number; revenue: number }>();
  traffic.forEach((t) => {
    const x = bySource.get(t.source) ?? { visitors: 0, spend: 0, requests: 0, bookings: 0, revenue: 0 };
    x.visitors += t.visitors;
    x.spend += t.spend;
    bySource.set(t.source, x);
  });
  leads.forEach((l) => {
    const s = leadChannel(l).source;
    const x = bySource.get(s) ?? { visitors: 0, spend: 0, requests: 0, bookings: 0, revenue: 0 };
    x.requests++;
    if (l.booking?.confirmed) {
      x.bookings++;
      x.revenue += l.booking.amount;
    }
    bySource.set(s, x);
  });

  const byCampaign = new Map<string, { source: string; spend: number; requests: number; bookings: number; revenue: number }>();
  traffic.forEach((t) => {
    if (t.campaign.startsWith('(')) return;
    const x = byCampaign.get(t.campaign) ?? { source: t.source, spend: 0, requests: 0, bookings: 0, revenue: 0 };
    x.spend += t.spend;
    byCampaign.set(t.campaign, x);
  });
  leads.forEach((l) => {
    const c = leadChannel(l).campaign;
    const x = byCampaign.get(c);
    if (!x) return;
    x.requests++;
    if (l.booking?.confirmed) {
      x.bookings++;
      x.revenue += l.booking.amount;
    }
  });

  const managerIds = [...new Set(leads.map((l) => l.managerId).filter(Boolean))] as string[];
  const byManager = managerIds.map((m) => {
    const ls = leads.filter((l) => l.managerId === m);
    const rs = ls.filter((l) => l.firstResponseAt).map((l) => (l.firstResponseAt! - l.createdAt) / 60000);
    const conf = ls.filter((l) => l.booking?.confirmed);
    return {
      managerId: m,
      requests: ls.length,
      processed: ls.filter((l) => !['new', 'in_progress'].includes(l.status)).length,
      avgResp: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN,
      overdue: ls.filter((l) => l.status === 'new' && Date.now() - l.createdAt > slaMin * 60000).length,
      bookings: conf.length,
      revenue: sum(conf, (l) => l.booking!.amount),
    };
  });

  const refusals = new Map<string, number>();
  leads.filter((l) => l.status === 'rejected').forEach((l) => refusals.set(l.refusalReason || 'Не указана', (refusals.get(l.refusalReason || 'Не указана') ?? 0) + 1));

  return {
    marketing: {
      visitors,
      impressions,
      uniqImpr,
      uniqOpens,
      starts,
      ctr: uniqOpens / uniqImpr,
      openToLead: requests / uniqOpens,
      spend,
      cpl: paidRequests ? spend / paidRequests : NaN,
      bookingClicks,
    },
    sales: {
      requests,
      uniqueLeads,
      reachRate: reached.length / processed.length,
      avgResp,
      medResp,
      p80Resp,
      missed: missed.length,
      leadToBooking: bookedKeys.size / uniqueLeads,
      bookings: confirmed.length,
      revenue,
      avgCheck: confirmed.length ? revenue / confirmed.length : NaN,
      directShare: allBookings ? confirmed.length / allBookings : NaN,
      allBookings,
    },
    byDay,
    perWidget,
    bySource: [...bySource.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.visitors - a.visitors),
    byCampaign: [...byCampaign.entries()].map(([campaign, v]) => ({ campaign, ...v })),
    byManager,
    refusals: [...refusals.entries()].sort((a, b) => b[1] - a[1]),
    leads,
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;
