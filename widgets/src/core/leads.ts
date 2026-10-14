import { track } from './analytics';
import { get, pushNotice, set } from './store';
import type { Lead, LeadSource, WidgetId } from './types';
import { isValidEmail, isValidPhone, phoneDigits, uid } from './util';
import { SOURCE_LABEL } from './defaults';

export interface LeadInput {
  source: LeadSource;
  name?: string;
  phone?: string;
  email?: string;
  preferredTime?: string;
  comment?: string;
  consent: boolean;
  /** honeypot - заполняют только боты */
  website?: string;
  /** когда форма была открыта (ms) - защита от мгновенной отправки ботом */
  openedAt?: number;
  quiz?: Record<string, string>;
  chatId?: string;
  clientHistory?: string[];
}

export type SubmitResult =
  | { ok: true; lead: Lead; repeat: boolean }
  | { ok: false; error: string };

const DUP_WINDOW_MS = 10 * 60 * 1000;
const MIN_FILL_MS = 2000;

/** Назначение ответственного: по кругу среди активных менеджеров с наименьшей нагрузкой. */
function pickManager(): string | undefined {
  const s = get();
  const managers = s.staff.filter((m) => m.role === 'manager' && m.active);
  if (!managers.length) return undefined;
  const load = (id: string) => s.leads.filter((l) => l.managerId === id && ['new', 'in_progress'].includes(l.status)).length;
  return managers.sort((a, b) => load(a.id) - load(b.id))[0].id;
}

/** Формат, в котором заявка уйдёт в Bitrix24 (crm.lead.add). В прототипе только показывается. */
export function bitrixPayload(l: Lead) {
  return {
    method: 'crm.lead.add',
    params: { REGISTER_SONET_EVENT: 'Y' },
    fields: {
      TITLE: `${SOURCE_LABEL[l.source]} #${l.num} - Варшавка 125`,
      NAME: l.name || '',
      PHONE: l.phone ? [{ VALUE: l.phone, VALUE_TYPE: 'WORK' }] : [],
      EMAIL: l.email ? [{ VALUE: l.email, VALUE_TYPE: 'WORK' }] : [],
      SOURCE_ID: 'WEB',
      SOURCE_DESCRIPTION: `Виджет: ${SOURCE_LABEL[l.source]}; страница: ${l.page}`,
      UTM_SOURCE: l.utm.utm_source || '',
      UTM_MEDIUM: l.utm.utm_medium || '',
      UTM_CAMPAIGN: l.utm.utm_campaign || '',
      UTM_CONTENT: l.utm.utm_content || '',
      UTM_TERM: l.utm.utm_term || '',
      ASSIGNED_BY_ID: `{{bitrix_user_id для ${l.managerId ?? 'по правилу распределения'}}}`,
      COMMENTS: [l.preferredTime && `Удобное время: ${l.preferredTime}`, l.comment, l.quiz && JSON.stringify(l.quiz)]
        .filter(Boolean)
        .join('\n'),
      UF_CRM_V125_VISITOR: l.visitorId,
      UF_CRM_V125_LEAD_ID: l.id,
    },
    dedupe: 'crm.duplicate.findbycomm(PHONE|EMAIL) → при совпадении: новая активность в существующем лиде/контакте',
  };
}

/** Куда уходит заявка помимо локального состояния. В embed - POST на сервер. */
export const leadSink: { send: (lead: Lead) => void } = { send: () => {} };

export function submitLead(input: LeadInput): SubmitResult {
  const s = get();
  // 1. Спам-защита
  if (input.website) return { ok: false, error: 'Не удалось отправить. Обновите страницу и попробуйте снова.' };
  if (input.openedAt && Date.now() - input.openedAt < MIN_FILL_MS)
    return { ok: false, error: 'Слишком быстро. Проверьте данные и отправьте ещё раз.' };
  if (!input.consent) return { ok: false, error: 'Нужно согласие на обработку персональных данных.' };
  if (input.phone && !isValidPhone(input.phone)) return { ok: false, error: 'Проверьте номер: нужен мобильный +7 9XX…' };
  if (input.email && !isValidEmail(input.email)) return { ok: false, error: 'Проверьте e-mail.' };
  if (!input.phone && !input.email && !input.chatId) return { ok: false, error: 'Укажите телефон или e-mail.' };

  // 2. Защита от повторной отправки: тот же контакт в течение 10 минут
  const key = input.phone ? phoneDigits(input.phone) : (input.email || '').toLowerCase();
  const last = key ? s.recentSubmits[key] : undefined;
  if (last && Date.now() - last < DUP_WINDOW_MS) {
    return { ok: false, error: 'Заявка с этим контактом уже принята. Специалист скоро свяжется с вами.' };
  }

  // 3. Повторное обращение (тот же контакт раньше) - связываем, а не плодим дубль
  const prev = key
    ? s.leads.find((l) => (l.phone && phoneDigits(l.phone) === key) || (l.email && l.email.toLowerCase() === key))
    : undefined;

  const num = s.leadSeq + 1;
  const crmConnected = s.config.integrations.find((i) => i.id === 'bitrix24')?.connected;
  const lead: Lead = {
    id: uid('l_'),
    num,
    createdAt: Date.now(),
    demo: true,
    source: input.source,
    name: input.name?.trim() || undefined,
    phone: input.phone,
    email: input.email?.trim() || undefined,
    preferredTime: input.preferredTime,
    comment: input.comment,
    status: 'new',
    managerId: pickManager(),
    reminders: 0,
    utm: s.visitor.utm,
    page: s.sim.path,
    device: s.visitor.device,
    visitorId: s.visitor.id,
    duplicateOf: prev?.id,
    quiz: input.quiz,
    chatId: input.chatId,
    history: [
      ...(input.clientHistory ?? []).map((t) => ({ at: Date.now(), kind: 'client' as const, text: t })),
      { at: Date.now(), kind: 'client', text: `Отправил заявку через «${SOURCE_LABEL[input.source]}»` },
      {
        at: Date.now(),
        kind: 'system',
        text: crmConnected
          ? 'Поставлено в очередь отправки в Bitrix24'
          : 'Bitrix24 не подключён: заявка сохранена в панели (DEMO)',
      },
      ...(prev ? [{ at: Date.now(), kind: 'system' as const, text: `Повторное обращение: связано с заявкой #${prev.num}` }] : []),
    ],
    crm: crmConnected
      ? { state: 'queued', note: 'Будет отправлено сервером' }
      : { state: 'not_connected', note: 'Интеграция не подключена' },
  };

  set((st) => ({
    leads: [lead, ...st.leads],
    leadSeq: num,
    recentSubmits: key ? { ...st.recentSubmits, [key]: Date.now() } : st.recentSubmits,
    visitor: { ...st.visitor, leadSubmitted: true },
  }));

  leadSink.send(lead);
  const manager = s.staff.find((m) => m.id === lead.managerId);
  pushNotice({
    text: `Новая заявка #${num} (${SOURCE_LABEL[input.source]})${manager ? ` → ${manager.name}` : ''}`,
    leadId: lead.id,
  });
  track('lead_submit', input.source as WidgetId, { lead: num });
  return { ok: true, lead, repeat: !!prev };
}

/**
 * Контроль SLA: необработанные заявки старше порога → напоминание ответственному,
 * затем повтор каждые N минут. В проде это делает серверный планировщик (очередь + cron),
 * в прототипе - таймер во вкладке.
 */
export function checkSla() {
  const s = get();
  const { firstAfterMin, repeatEveryMin } = s.config.reminders;
  const now = Date.now();
  s.leads.forEach((l) => {
    if (l.status !== 'new' || l.createdAt < now - 86400000) return;
    const age = (now - l.createdAt) / 60000;
    const sinceRem = l.lastReminderAt ? (now - l.lastReminderAt) / 60000 : Infinity;
    if (age >= firstAfterMin && sinceRem >= repeatEveryMin) {
      const m = s.staff.find((x) => x.id === l.managerId);
      pushNotice({
        text: `Напоминание${l.reminders ? ` №${l.reminders + 1}` : ''}: заявка #${l.num} ждёт ${Math.round(age)} мин${m ? ` (${m.name})` : ''}`,
        leadId: l.id,
      });
      set((st) => ({
        leads: st.leads.map((x) =>
          x.id === l.id
            ? {
                ...x,
                lastReminderAt: now,
                reminders: x.reminders + 1,
                history: [...x.history, { at: now, kind: 'system', text: `Напоминание менеджеру отправлено (${x.reminders + 1})` }],
              }
            : x,
        ),
      }));
    }
  });
}
