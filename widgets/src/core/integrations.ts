import { BNOVO_MODULE_UID, CATEGORIES } from './defaults';
import { get } from './store';
import { isoDate, nightsBetween, rng } from './util';

/**
 * Слой интеграций. Каждая интеграция имеет три состояния:
 *  - none: не подключена. Виджеты работают без неё и НЕ выдумывают данные.
 *  - demo: явно помеченные DEMO-данные (только для презентации прототипа).
 *  - live: данные с сервера (/api/bnovo/*). Ключи Bnovo хранятся только на сервере.
 */
export type SourceKind = 'none' | 'demo' | 'live';

export interface CategoryOffer {
  key: string;
  name: string;
  available: number;
  total: number;
  /** Цена за весь период из Bnovo. null - тариф не получен. */
  price: number | null;
  maxGuests: number;
  demo: boolean;
}

export interface ProofSignal {
  id: string;
  text: string;
  /** На чём основано утверждение - видно в админке */
  basis: string;
  demo: boolean;
}

export function bnovoSource(): SourceKind {
  const s = get();
  if (s.config.integrations.find((i) => i.id === 'bnovo')?.connected) return 'live';
  return s.sim.bnovoDemo ? 'demo' : 'none';
}

/** Ссылка в модуль бронирования Bnovo с датами и гостями (формат как в availability.gs). */
export function bookingUrl(checkIn?: string, checkOut?: string, adults?: number): string {
  const s = get();
  const base = s.config.contacts.bookingUrl || `https://reservationsteps.ru/rooms/index/${BNOVO_MODULE_UID}`;
  const p = new URLSearchParams({ lang: 'ru' });
  const ru = (iso: string) => iso.split('-').reverse().join('-');
  if (checkIn && checkOut) {
    p.set('dfrom', ru(checkIn));
    p.set('dto', ru(checkOut));
  }
  if (adults) p.set('adults', String(adults));
  Object.entries(s.visitor.utm).forEach(([k, v]) => p.set(k, v));
  return `${base}?${p.toString()}`;
}

// DEMO-генератор наличия: цена = цена «от» с сайта × случайная наценка. Только для демонстрации.

export async function getOffers(checkIn: string, checkOut: string, guests: number): Promise<CategoryOffer[] | null> {
  const kind = bnovoSource();
  if (kind === 'none') return null;
  if (kind === 'live') {
    // Прод: GET /api/bnovo/availability?from&to&adults - сервер ходит в Bnovo с ключом
    const r = await fetch(`/api/bnovo/availability?from=${checkIn}&to=${checkOut}&adults=${guests}`);
    if (!r.ok) throw new Error('Bnovo недоступен');
    return r.json();
  }
  await new Promise((r) => setTimeout(r, 450));
  const nights = Math.max(1, nightsBetween(checkIn, checkOut));
  const seed = Number(checkIn.replace(/-/g, '')) + nights;
  const rand = rng(seed);
  return CATEGORIES.map((c) => {
    const available = Math.max(0, Math.round(rand() * c.total * 0.6) - (rand() < 0.2 ? c.total : 0));
    return {
      key: c.key,
      name: c.name,
      total: c.total,
      available,
      price: available ? Math.round((c.fromPrice * nights * (1 + rand() * 0.35)) / 100) * 100 : null,
      maxGuests: c.maxGuests,
      demo: true,
    };
  }).filter((o) => o.maxGuests >= guests);
}

/**
 * Сигналы для уведомлений о бронированиях. Формируются ТОЛЬКО из фактов Bnovo по порогам.
 * Нет источника → пустой список → виджет не показывается.
 */
export function getProofSignals(): ProofSignal[] {
  const kind = bnovoSource();
  if (kind === 'none') return [];
  if (kind === 'live') return liveSignalsCache;
  // DEMO: фиксированные «факты», из которых по тем же правилам строятся тексты
  const facts = {
    bookingsTodayForWeekend: 3,
    longStayShare7d: 0.58,
    nearestHighOccupancy: { date: isoDate(new Date(Date.now() + 9 * 86400000)), occ: 0.88 },
  };
  return buildSignals(facts, true);
}

let liveSignalsCache: ProofSignal[] = [];

export interface ProofFacts {
  bookingsTodayForWeekend: number;
  longStayShare7d: number;
  nearestHighOccupancy: { date: string; occ: number } | null;
}

/** Правила: утверждение показывается только если факт превышает порог. */
export function buildSignals(f: ProofFacts, demo: boolean): ProofSignal[] {
  const out: ProofSignal[] = [];
  if (f.bookingsTodayForWeekend >= 1)
    out.push({
      id: 'weekend',
      text: 'Сегодня забронированы апартаменты на ближайшие выходные',
      basis: `Bnovo: ${f.bookingsTodayForWeekend} брони создано сегодня с заездом на ближайшие выходные`,
      demo,
    });
  if (f.longStayShare7d >= 0.5)
    out.push({
      id: 'long',
      text: 'Гости выбирают проживание на несколько ночей',
      basis: `Bnovo: ${Math.round(f.longStayShare7d * 100)}% броней за 7 дней - от 3 ночей`,
      demo,
    });
  if (f.nearestHighOccupancy && f.nearestHighOccupancy.occ >= 0.85) {
    const [, m, d] = f.nearestHighOccupancy.date.split('-');
    out.push({
      id: 'occ',
      text: `Популярные даты быстро заполняются: на ${d}.${m} занято больше 85% апартаментов`,
      basis: `Bnovo: загрузка на ${d}.${m} - ${Math.round(f.nearestHighOccupancy.occ * 100)}% (порог 85%)`,
      demo,
    });
  }
  return out;
}
