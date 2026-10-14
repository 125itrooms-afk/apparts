import { get, set } from './store';
import type { ABTest, Scenario, Segment, Trigger, Variant, Visitor } from './types';

/** Стабильное назначение варианта A/B-теста посетителю (по весам), сохраняется в профиле посетителя. */
export function abVariant(test: ABTest | undefined): Variant | undefined {
  if (!test || test.status !== 'running' || !test.variants.length) return undefined;
  const s = get();
  const saved = s.visitor.abAssign[test.id];
  const found = test.variants.find((v) => v.id === saved);
  if (found) return found;
  const total = test.variants.reduce((a, v) => a + v.weight, 0) || 1;
  let r = Math.random() * total;
  let pick = test.variants[0];
  for (const v of test.variants) {
    if ((r -= v.weight) <= 0) {
      pick = v;
      break;
    }
  }
  set((st) => ({ visitor: { ...st.visitor, abAssign: { ...st.visitor.abAssign, [test.id]: pick.id } } }));
  return pick;
}

export function segmentMatches(seg: Segment, v: Visitor, path: string): boolean {
  if (!seg.enabled || !seg.conditions.length) return false;
  return seg.conditions.every((c) => {
    const val = c.value.toLowerCase();
    switch (c.type) {
      case 'returning':
        return v.visits > 1;
      case 'utm_source':
        return (v.utm.utm_source || '').toLowerCase().includes(val);
      case 'utm_campaign':
        return (v.utm.utm_campaign || '').toLowerCase().includes(val);
      case 'referrer':
        return v.referrer.toLowerCase().includes(val);
      case 'url':
        return path.startsWith(c.value);
      case 'action':
        return v.actions.includes(c.value);
    }
  });
}

export interface ResolvedPersonalization {
  segment: Segment | null;
  headline: string;
  subline: string;
  cta: string;
  variant?: string;
}

/** Сегмент с наименьшим числом priority выигрывает. */
export function resolvePersonalization(): ResolvedPersonalization {
  const s = get();
  const p = s.config.widgets.personalization;
  const base = { segment: null, headline: p.defaultHeadline, subline: p.defaultSubline, cta: p.defaultCta };
  if (!p.enabled) return base;
  const seg = [...p.segments]
    .sort((a, b) => a.priority - b.priority)
    .find((x) => segmentMatches(x, s.visitor, s.sim.path));
  if (!seg) return base;
  const v = abVariant(s.config.abTests.find((t) => t.id === seg.abTestId));
  return v
    ? { segment: seg, headline: v.title, subline: v.text, cta: v.button, variant: v.id }
    : { segment: seg, headline: seg.headline, subline: seg.subline, cta: seg.cta };
}

/** Поведенческий контекст для триггеров генератора заявок. */
export interface BehaviorCtx {
  secondsOnSite: number;
  scrollPct: number;
  /** секунд на текущей странице */
  secondsOnPage: number;
  exitIntent: boolean;
  path: string;
  /** Сколько секунд суммарно блок страницы был на экране: селектор → секунды */
  inview: Record<string, number>;
}

/** «#rooms:25» → ['#rooms', 25] */
export function parseInview(v: string): [string, number] {
  const i = v.lastIndexOf(':');
  return i > 0 ? [v.slice(0, i).trim(), Number(v.slice(i + 1)) || 0] : [v.trim(), 0];
}

export function triggerMet(t: Trigger, ctx: BehaviorCtx, v: Visitor): boolean {
  switch (t.type) {
    case 'exit':
      return ctx.exitIntent;
    case 'time':
      return ctx.secondsOnSite >= Number(t.value || 0);
    case 'scroll':
      return ctx.scrollPct >= Number(t.value || 0);
    case 'section':
      return ctx.secondsOnPage >= Number(t.value || 0);
    case 'inview': {
      const [sel, sec] = parseInview(t.value);
      return (ctx.inview[sel] ?? 0) >= sec;
    }
    case 'url':
      return ctx.path.startsWith(t.value);
    case 'utm':
      return Object.values(v.utm).some((x) => x.toLowerCase().includes(t.value.toLowerCase()));
    case 'action':
      return v.actions.includes(t.value);
  }
}

export const TRIGGER_LABEL: Record<Trigger['type'], string> = {
  exit: 'Намерение уйти (курсор к закрытию / быстрый скролл вверх на мобильном)',
  time: 'Время на сайте, сек ≥',
  scroll: 'Прокрутка страницы, % ≥',
  section: 'Время на текущей странице, сек ≥',
  inview: 'Блок страницы на экране (селектор:сек), например #rooms:25',
  url: 'URL начинается с',
  utm: 'UTM-метка содержит',
  action: 'Действие посетителя',
};

/** Ограничение частоты: один сценарий - не чаще capHours, всего за визит - не больше maxPerSession. */
export function canShowScenario(sc: Scenario, sessionShown: number, maxPerSession: number): boolean {
  const s = get();
  if (s.visitor.leadSubmitted) return false;
  if (sessionShown >= maxPerSession) return false;
  const last = s.visitor.shown['popup:' + sc.id];
  return !last || Date.now() - last > sc.capHours * 3600000;
}

export function pickScenario(ctx: BehaviorCtx, sessionShown: number): Scenario | null {
  const s = get();
  const cfg = s.config.widgets.leadPopup;
  if (!cfg.enabled || ctx.secondsOnSite < cfg.minSecondsOnSite) return null;
  const list = [...cfg.scenarios].filter((x) => x.enabled).sort((a, b) => a.priority - b.priority);
  for (const sc of list) {
    if (sc.triggers.every((t) => triggerMet(t, ctx, s.visitor)) && canShowScenario(sc, sessionShown, cfg.maxPerSession))
      return sc;
  }
  return null;
}

/** Двусторонний z-тест разницы конверсий (для A/B-отчёта). */
export function zTest(c1: number, n1: number, c2: number, n2: number) {
  if (n1 < 1 || n2 < 1) return { z: 0, p: 1 };
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const p = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, p: 1 };
  const z = (p2 - p1) / se;
  return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
}

function normCdf(x: number) {
  // Abramowitz-Stegun
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}
