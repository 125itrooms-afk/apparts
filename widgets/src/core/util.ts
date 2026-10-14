import type { WorkHours } from './types';

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим, квота - работаем без сохранения */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Маска +7 (XXX) XXX-XX-XX. Принимает любой ввод, возвращает отформатированную строку. */
export function maskPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = '+7';
  if (p.length > 0) out += ' (' + p.slice(0, 3);
  if (p.length >= 3) out += ')';
  if (p.length > 3) out += ' ' + p.slice(3, 6);
  if (p.length > 6) out += '-' + p.slice(6, 8);
  if (p.length > 8) out += '-' + p.slice(8, 10);
  return out;
}

export const phoneDigits = (s: string) => {
  let d = s.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  return d;
};

export const isValidPhone = (s: string) => /^79\d{9}$/.test(phoneDigits(s));
export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtTime = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtDateTime = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${fmtTime(t)}`;
};
export const fmtDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ruDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y ? `${d}.${m}` : iso;
};

export const money = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
export const num = (n: number) => Math.round(n).toLocaleString('ru-RU');
export const pct = (x: number, digits = 1) => (isFinite(x) ? (x * 100).toFixed(digits).replace('.', ',') + '%' : '-');

export const minutesAgo = (t: number) => Math.max(0, Math.round((Date.now() - t) / 60000));

/** Рабочее ли время по Москве (в прототипе - локальное время браузера). */
export function isWorkingTime(h: WorkHours, at = new Date()): boolean {
  const day = at.getDay() === 0 ? 7 : at.getDay();
  if (!h.days.includes(day)) return false;
  const cur = at.getHours() * 60 + at.getMinutes();
  const [fh, fm] = h.from.split(':').map(Number);
  const [th, tm] = h.to.split(':').map(Number);
  return cur >= fh * 60 + fm && cur < th * 60 + tm;
}

/** Честное обещание времени ответа с учётом рабочих часов. */
export function responsePromise(h: WorkHours, minutes: number, at = new Date()): string {
  if (isWorkingTime(h, at)) return `в течение ${minutes} минут`;
  return `в рабочее время, с ${h.from}`;
}

/** Слоты для выбора удобного времени звонка (сегодня/завтра в рабочие часы). */
export function callSlots(h: WorkHours, at = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  // гостю предлагаем дневные слоты, даже если линия работает круглосуточно
  const fh = Math.max(9, Number(h.from.split(':')[0]));
  const th = Math.min(21, Number(h.to.split(':')[0]));
  for (let dayOff = 0; dayOff < 2; dayOff++) {
    const base = new Date(at);
    base.setDate(base.getDate() + dayOff);
    const dow = base.getDay() === 0 ? 7 : base.getDay();
    if (!h.days.includes(dow)) continue;
    for (let hr = fh; hr < th; hr += 2) {
      if (dayOff === 0 && hr <= at.getHours()) continue;
      const label = `${dayOff === 0 ? 'Сегодня' : 'Завтра'}, ${pad(hr)}:00-${pad(Math.min(hr + 2, th))}:00`;
      out.push({ value: label, label });
    }
  }
  return out;
}

export function nightsBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Math.max(0, Math.round(d));
}

/** Детерминированный ГПСЧ для DEMO-данных. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (isNaN(n)) return '47 58 54';
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Проверка URL-правил показа: include '*', или список префиксов. */
export function pageMatches(path: string, include: string, exclude: string): boolean {
  const list = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const hit = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  const inc = list(include);
  const exc = list(exclude);
  if (exc.some(hit)) return false;
  if (inc.length === 0 || inc.includes('*')) return true;
  return inc.some(hit);
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
