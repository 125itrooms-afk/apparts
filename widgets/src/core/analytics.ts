import { get, logEvent } from './store';
import type { EventName, WidgetId } from './types';

/**
 * Единая точка трекинга. Каждое событие:
 *  1) пишется в журнал (в прототипе - в память, в проде - POST /api/events);
 *  2) отправляется целью в Яндекс Метрику, если счётчик подключён и ym() есть на странице.
 * Имена целей стабильные - их нужно один раз создать в Метрике (тип «JavaScript-событие»).
 */
export const GOALS: Record<EventName, (w?: WidgetId) => string> = {
  page_view: () => 'v125_page_view',
  widget_impression: (w) => `v125_${w}_view`,
  widget_open: (w) => `v125_${w}_open`,
  form_start: (w) => `v125_${w}_start`,
  lead_submit: (w) => `v125_${w}_lead`,
  booking_click: (w) => `v125_booking_click${w ? '_' + w : ''}`,
  chat_message: () => 'v125_chat_message',
  quiz_step: () => 'v125_quiz_step',
  popup_close: (w) => `v125_${w}_close`,
};

declare global {
  interface Window {
    ym?: (id: number, method: string, goal: string, params?: object) => void;
  }
}

const startedForms = new Set<string>();

export function track(name: EventName, widget?: WidgetId, data?: Record<string, string | number | boolean>) {
  const goal = GOALS[name](widget);
  logEvent({ name, widget, data, goal });
  const metrika = get().config.integrations.find((i) => i.id === 'metrika');
  const counter = Number(metrika?.params.counterId);
  if (metrika?.connected && counter && typeof window.ym === 'function') {
    try {
      window.ym(counter, 'reachGoal', goal, data);
    } catch {
      /* Метрика не должна ломать виджеты */
    }
  }
}

/** form_start - один раз на форму за визит */
export function trackFormStart(widget: WidgetId) {
  const key = get().visitor.id + widget;
  if (startedForms.has(key)) return;
  startedForms.add(key);
  track('form_start', widget);
}
