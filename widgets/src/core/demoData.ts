import { REFUSAL_REASONS } from './defaults';
import type { Lead, LeadSource, LeadStatus, WidgetId } from './types';
import { isoDate, maskPhone, rng } from './util';

/**
 * DEMO-набор для аналитики: 90 дней синтетических данных.
 * Всё здесь - выдуманные цифры для демонстрации формул и интерфейса. В интерфейсе маркируется DEMO.
 */

export interface Channel {
  source: string;
  campaign: string;
  paid: boolean;
  weight: number;
}

export const CHANNELS: Channel[] = [
  { source: 'Яндекс поиск', campaign: '(органика)', paid: false, weight: 30 },
  { source: 'Яндекс Директ', campaign: 'apart_moscow', paid: true, weight: 18 },
  { source: 'Яндекс Директ', campaign: 'long_stay', paid: true, weight: 6 },
  { source: 'Корпоративная РК', campaign: 'corp_b2b', paid: true, weight: 5 },
  { source: 'ВКонтакте', campaign: 'family_vk', paid: true, weight: 7 },
  { source: 'Прямые заходы', campaign: '(нет)', paid: false, weight: 20 },
  { source: 'Карты и справочники', campaign: '(нет)', paid: false, weight: 9 },
  { source: 'Другие сайты', campaign: '(нет)', paid: false, weight: 5 },
];

export const TRACKED_WIDGETS: WidgetId[] = ['callback', 'chat', 'multibutton', 'leadPopup', 'quiz', 'video', 'socialProof'];

export interface TrafficRow {
  day: string;
  source: string;
  campaign: string;
  device: 'desktop' | 'mobile';
  visitors: number;
  spend: number;
}

export interface WidgetRow {
  day: string;
  source: string;
  campaign: string;
  device: 'desktop' | 'mobile';
  widget: WidgetId;
  impressions: number;
  uniqImpressions: number;
  uniqOpens: number;
  starts: number;
  bookingClicks: number;
}

export interface OtaRow {
  day: string;
  /** Все подтверждённые брони по всем каналам (Bnovo), включая OTA */
  allBookings: number;
  directBookings: number;
}

/** Заявка с каналом и кампанией (для фильтров аналитики) */
export type DemoLead = Lead & { channel?: string; campaign?: string };

export interface DemoDataset {
  traffic: TrafficRow[];
  widgets: WidgetRow[];
  leads: DemoLead[];
  bookingsAll: OtaRow[];
}

// Базовые коэффициенты воронок по виджетам (DEMO)
const W: Record<string, { show: number; open: number; start: number; submit: number; book: number }> = {
  callback: { show: 0.92, open: 0.045, start: 0.55, submit: 0.42, book: 0.01 },
  chat: { show: 0.92, open: 0.06, start: 0.7, submit: 0.2, book: 0.08 },
  multibutton: { show: 0.95, open: 0.07, start: 0.3, submit: 0.05, book: 0.25 },
  leadPopup: { show: 0.22, open: 0.9, start: 0.12, submit: 0.45, book: 0 },
  quiz: { show: 0.6, open: 0.08, start: 0.75, submit: 0.3, book: 0.15 },
  video: { show: 0.5, open: 0.18, start: 0.1, submit: 0.1, book: 0.2 },
  socialProof: { show: 0.4, open: 0.03, start: 0, submit: 0, book: 0.05 },
};

const MANAGERS = ['m1', 'm2', 'm3'];
const NAMES = ['Алексей', 'Мария', 'Сергей', 'Екатерина', 'Дмитрий', 'Анна', 'Павел', 'Ольга', 'Иван', 'Наталья', ''];

let cache: DemoDataset | null = null;

export function demoDataset(): DemoDataset {
  if (cache) return cache;
  const r = rng(125125);
  const traffic: TrafficRow[] = [];
  const widgets: WidgetRow[] = [];
  const leads: DemoLead[] = [];
  const bookingsAll: OtaRow[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let num = 100;
  const phones: string[] = [];

  for (let d = 89; d >= 0; d--) {
    const date = new Date(today.getTime() - d * 86400000);
    const day = isoDate(date);
    const dow = date.getDay();
    const season = 1 + 0.15 * Math.sin((90 - d) / 14);
    const dayFactor = (dow === 5 || dow === 4 ? 1.15 : dow === 6 ? 0.9 : 1) * season;
    let dayDirect = 0;

    for (const ch of CHANNELS) {
      for (const device of ['desktop', 'mobile'] as const) {
        const share = device === 'mobile' ? 0.62 : 0.38;
        const visitors = Math.round(ch.weight * 9 * share * dayFactor * (0.8 + r() * 0.4));
        const spend = ch.paid ? Math.round(visitors * (ch.source === 'Корпоративная РК' ? 95 : 38) * (0.85 + r() * 0.3)) : 0;
        traffic.push({ day, source: ch.source, campaign: ch.campaign, device, visitors, spend });

        for (const w of TRACKED_WIDGETS) {
          const f = W[w];
          const devAdj = device === 'mobile' && w === 'video' ? 0.6 : 1;
          const corpAdj = ch.source === 'Корпоративная РК' && (w === 'leadPopup' || w === 'callback') ? 1.6 : 1;
          const uniqImpressions = Math.round(visitors * f.show * devAdj);
          const impressions = Math.round(uniqImpressions * (1.3 + r() * 0.5));
          const uniqOpens = Math.round(uniqImpressions * f.open * corpAdj * (0.75 + r() * 0.5));
          const starts = Math.round(uniqOpens * f.start * (0.8 + r() * 0.4));
          let submits = 0;
          for (let i = 0; i < starts; i++) if (r() < f.submit * corpAdj) submits++;
          const bookingClicks = Math.round(uniqOpens * f.book * (0.7 + r() * 0.6));
          widgets.push({ day, source: ch.source, campaign: ch.campaign, device, widget: w, impressions, uniqImpressions, uniqOpens, starts, bookingClicks });

          for (let i = 0; i < submits; i++) {
            const created = date.getTime() + (9 + r() * 13) * 3600000;
            if (created > Date.now() - 5 * 60000) continue;
            const repeat = phones.length > 10 && r() < 0.12;
            const phone = repeat ? phones[Math.floor(r() * phones.length)] : maskPhone('79' + String(Math.floor(r() * 1e9)).padStart(9, '0'));
            if (!repeat) phones.push(phone);
            const managerId = MANAGERS[Math.floor(r() * 3)];
            const speed = managerId === 'm2' ? 2.2 : managerId === 'm3' ? 1.4 : 1;
            const missed = r() < 0.07;
            const nightTime = new Date(created).getHours() >= 21;
            const respMin = missed ? undefined : Math.round((nightTime ? 600 : 2 + r() * 9 * speed) + (r() < 0.1 ? 30 : 0));
            let status: LeadStatus;
            const reached = !missed && r() < 0.83;
            const bookP = (ch.source === 'Корпоративная РК' ? 0.34 : ch.campaign === 'long_stay' ? 0.3 : 0.22) * (w === 'quiz' || w === 'chat' ? 1.15 : 1);
            if (d < 1 && r() < 0.5) status = 'new';
            else if (missed) status = d < 3 ? 'new' : 'not_reached';
            else if (!reached) status = 'not_reached';
            else if (r() < bookP / 0.83) status = 'booked';
            else if (d < 4 && r() < 0.4) status = 'in_progress';
            else if (r() < 0.75) status = 'rejected';
            else status = 'reached';
            const nights = ch.campaign === 'long_stay' ? 14 + Math.floor(r() * 16) : 1 + Math.floor(r() * (ch.source === 'Корпоративная РК' ? 10 : 5));
            const adr = 4500 + r() * 3500;
            const confirmed = status === 'booked' && r() < 0.88;
            if (confirmed) dayDirect++;
            leads.push({
              id: `demo-${num}`,
              num: num++,
              createdAt: created,
              demo: true,
              source: w as LeadSource,
              name: NAMES[Math.floor(r() * NAMES.length)] || undefined,
              phone,
              status,
              managerId,
              firstResponseAt: respMin !== undefined && status !== 'new' ? created + respMin * 60000 : undefined,
              reminders: missed ? 2 : 0,
              refusalReason: status === 'rejected' ? REFUSAL_REASONS[Math.floor(r() * REFUSAL_REASONS.length)] : undefined,
              booking: status === 'booked' ? { amount: Math.round((nights * adr) / 100) * 100, nights, confirmed, bnovoId: confirmed ? `DEMO-${50000 + num}` : undefined } : undefined,
              utm: ch.paid ? { utm_source: ch.source === 'ВКонтакте' ? 'vk' : 'yandex', utm_medium: 'cpc', utm_campaign: ch.campaign } : {},
              page: ['/', '/apartments', '/prices', '/long-stay', '/corporate'][Math.floor(r() * 5)],
              device,
              visitorId: 'demo-v' + num,
              duplicateOf: repeat ? 'repeat' : undefined,
              history: [
                { at: created, kind: 'client', text: 'Отправил заявку (DEMO)' },
                ...(respMin !== undefined && status !== 'new'
                  ? [{ at: created + respMin * 60000, kind: 'manager' as const, text: 'Первый контакт (DEMO)' }]
                  : []),
              ],
              crm: { state: 'not_connected', note: 'DEMO' },
              ...(ch.source === 'Корпоративная РК' ? { comment: 'Компания (DEMO)' } : {}),
              channel: ch.source,
              campaign: ch.campaign,
            });
          }
        }
      }
    }
    const ota = Math.round(9 * dayFactor * (0.7 + r() * 0.6));
    const phoneDirect = Math.round(2 * (0.5 + r()));
    bookingsAll.push({ day, allBookings: ota + phoneDirect + dayDirect, directBookings: dayDirect });
  }
  cache = { traffic, widgets, leads, bookingsAll };
  return cache;
}


/** Последние DEMO-заявки для наполнения списка в панели */
export function seedLeads(count = 24): Lead[] {
  return [...demoDataset().leads].sort((a, b) => b.createdAt - a.createdAt).slice(0, count);
}
