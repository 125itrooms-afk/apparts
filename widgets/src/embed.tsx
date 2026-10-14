/**
 * Точка входа для установки на сайт отеля одним скриптом:
 *   <script>window.V125_WIDGETS_CONFIG = { ... }</script>          (необязательно: настройки под сайт)
 *   <script src=".../v125-widgets.js" data-site="varshavka125" data-api="https://.../api" defer></script>
 *
 * Без data-api виджеты работают в режиме предпросмотра: всё кликается, но заявки никуда не отправляются,
 * о чём гость видит честную подпись. С data-api - боевой режим: заявки и события уходят на сервер.
 * Виджеты монтируются в Shadow DOM: стили сайта и модуля бронирования не пересекаются с виджетами.
 */
import { createRoot } from 'react-dom/client';
import css from './widgets.css?inline';
import { leadSink } from './core/leads';
import { resolvePersonalization } from './core/rules';
import { nav, set, storeOptions, useApp } from './core/store';
import type { Config } from './core/types';
import { safeStorage } from './core/util';
import { HostCtx } from './widgets/shared';
import { WidgetHost } from './widgets/WidgetHost';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

declare global {
  interface Window {
    V125_WIDGETS_CONFIG?: DeepPartial<Config>;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
const api = script?.dataset.api?.replace(/\/$/, '');
const site = script?.dataset.site ?? 'default';

/** Слияние настроек: объекты - рекурсивно, массивы и значения - заменяются целиком */
function merge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return (patch ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const b = out[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) ? merge(b, v) : v;
  }
  return out as T;
}

/** Тексты сегмента - в элементы сайта (только для русской версии страницы и только если сегмент найден) */
function applyPersonalization() {
  const t = useApp.getState().config.widgets.personalization.targets;
  if (!t.headline && !t.subline) return;
  if ((document.documentElement.lang || 'ru') !== 'ru') return;
  const p = resolvePersonalization();
  if (!p.segment) return;
  const h = t.headline ? document.querySelector(t.headline) : null;
  const sub = t.subline ? document.querySelector(t.subline) : null;
  if (h) h.textContent = p.headline;
  if (sub) sub.textContent = p.subline;
}

async function boot() {
  storeOptions.persist = false;
  if (document.getElementById('v125-widgets-host')) return; // защита от двойной вставки

  // Настройки: с сервера (боевой режим) поверх локальных из window.V125_WIDGETS_CONFIG
  let remote: DeepPartial<Config> | undefined = window.V125_WIDGETS_CONFIG;
  if (api) {
    try {
      const r = await fetch(`${api}/public/config?site=${encodeURIComponent(site)}`, { credentials: 'omit' });
      if (r.ok) remote = merge(remote ?? {}, await r.json());
    } catch {
      /* без ответа сервера - локальные настройки */
    }
  }

  // Профиль посетителя (без персональных данных)
  const vKey = 'v125-visitor';
  const prev = safeStorage.get<{ id: string; visits: number; firstSeen: number; abAssign: Record<string, string>; shown: Record<string, number>; last: number } | null>(vKey, null);
  const newVisit = !prev || Date.now() - prev.last > 30 * 60 * 1000;
  const params = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => params.get(k) && (utm[k] = params.get(k)!));

  set((s) => {
    const config = remote ? merge(s.config, remote) : s.config;
    const mobile = window.matchMedia(`(max-width: ${config.layout.mobileBreakpoint}px)`).matches;
    return {
      env: api ? 'live' : 'preview',
      mode: 'site',
      config,
      leads: [],
      chats: [],
      sim: { ...s.sim, path: location.pathname, frame: mobile ? 'mobile' : 'desktop', bnovoDemo: false },
      visitor: {
        ...s.visitor,
        id: prev?.id ?? s.visitor.id,
        visits: (prev?.visits ?? 0) + (newVisit ? 1 : 0) || 1,
        firstSeen: prev?.firstSeen ?? Date.now(),
        abAssign: prev?.abAssign ?? {},
        shown: prev?.shown ?? {},
        utm,
        referrer: document.referrer,
        device: mobile ? 'mobile' : 'desktop',
      },
    };
  });
  useApp.subscribe((s) =>
    safeStorage.set(vKey, { id: s.visitor.id, visits: s.visitor.visits, firstSeen: s.visitor.firstSeen, abAssign: s.visitor.abAssign, shown: s.visitor.shown, last: Date.now() }),
  );
  const mq = window.matchMedia(`(max-width: ${useApp.getState().config.layout.mobileBreakpoint}px)`);
  mq.addEventListener('change', (e) => set((s) => ({ sim: { ...s.sim, frame: e.matches ? 'mobile' : 'desktop' } })));

  nav.go = (path) => location.assign(path);
  applyPersonalization();

  // Заявки - на сервер (боевой режим). В предпросмотре никуда не уходят, гость видит об этом подпись.
  leadSink.send = (lead) => {
    if (!api) return;
    fetch(`${api}/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, lead }),
      keepalive: true,
    }).catch(() => console.error('[v125] не удалось отправить заявку'));
  };

  const hostEl = document.createElement('div');
  hostEl.id = 'v125-widgets-host';
  document.body.appendChild(hostEl);
  const shadow = hostEl.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  const mount = document.createElement('div');
  shadow.appendChild(mount);
  createRoot(mount).render(
    <HostCtx.Provider value={{ scrollEl: () => window, embedded: true }}>
      <WidgetHost />
    </HostCtx.Provider>,
  );
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot());
else void boot();
