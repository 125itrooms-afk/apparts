/**
 * Точка входа для установки на сайт отеля одним скриптом:
 *   <script src=".../v125-widgets.js" data-site="varshavka125" data-api="https://.../api" async></script>
 * Виджеты монтируются в Shadow DOM: стили сайта и модуля бронирования не пересекаются с виджетами.
 */
import { createRoot } from 'react-dom/client';
import css from './widgets.css?inline';
import { leadSink } from './core/leads';
import { nav, set, storeOptions, useApp } from './core/store';
import type { Config } from './core/types';
import { safeStorage } from './core/util';
import { HostCtx } from './widgets/shared';
import { WidgetHost } from './widgets/WidgetHost';

declare global {
  interface Window {
    V125_WIDGETS_CONFIG?: Partial<Config>;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
const api = script?.dataset.api?.replace(/\/$/, '');
const site = script?.dataset.site ?? 'default';

async function boot() {
  storeOptions.persist = false;
  if (document.getElementById('v125-widgets-host')) return; // защита от двойной вставки

  // Конфигурация: с сервера или из глобальной переменной (без сервера)
  let remote: Partial<Config> | undefined = window.V125_WIDGETS_CONFIG;
  if (api) {
    try {
      const r = await fetch(`${api}/public/config?site=${encodeURIComponent(site)}`, { credentials: 'omit' });
      if (r.ok) remote = await r.json();
    } catch {
      /* без конфигурации - значения по умолчанию */
    }
  }

  // Профиль посетителя (без персональных данных)
  const vKey = 'v125-visitor';
  const prev = safeStorage.get<{ id: string; visits: number; firstSeen: number; abAssign: Record<string, string>; shown: Record<string, number>; last: number } | null>(vKey, null);
  const newVisit = !prev || Date.now() - prev.last > 30 * 60 * 1000;
  const params = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => params.get(k) && (utm[k] = params.get(k)!));
  const mobile = window.matchMedia('(max-width: 640px)').matches;

  set((s) => ({
    mode: 'site',
    config: remote ? { ...s.config, ...remote, widgets: { ...s.config.widgets, ...(remote.widgets ?? {}) } } : s.config,
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
  }));
  useApp.subscribe((s) =>
    safeStorage.set(vKey, { id: s.visitor.id, visits: s.visitor.visits, firstSeen: s.visitor.firstSeen, abAssign: s.visitor.abAssign, shown: s.visitor.shown, last: Date.now() }),
  );
  window.matchMedia('(max-width: 640px)').addEventListener('change', (e) => set((s) => ({ sim: { ...s.sim, frame: e.matches ? 'mobile' : 'desktop' } })));

  nav.go = (path) => location.assign(path);

  // Заявки - на сервер. Без data-api заявки не уходят никуда, о чём пишем в консоль.
  leadSink.send = (lead) => {
    if (!api) return console.warn('[v125] data-api не задан: заявка не отправлена на сервер', lead.num);
    const body = JSON.stringify({ site, lead });
    fetch(`${api}/public/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {
      console.error('[v125] не удалось отправить заявку');
    });
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
