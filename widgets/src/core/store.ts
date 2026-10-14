import { create } from 'zustand';
import { defaultConfig, DEMO_STAFF } from './defaults';
import type {
  Chat,
  ChatMessage,
  Config,
  Lead,
  LeadEvent,
  Role,
  Staff,
  TrackEvent,
  Visitor,
  WidgetId,
} from './types';
import { safeStorage, uid } from './util';

const KEY = 'v125-demo-v1';

export type OpenPanel = null | 'callback' | 'chat' | 'quiz' | 'leadPopup';

export interface PopupState {
  scenarioId: string;
  variantId?: string;
  title: string;
  text: string;
  button: string;
}

export interface Notice {
  id: string;
  at: number;
  text: string;
  leadId?: string;
  chatId?: string;
  read: boolean;
}

export interface Sim {
  path: string;
  /** DEMO-источник данных Bnovo (явно помечается в интерфейсе) */
  bnovoDemo: boolean;
  frame: 'desktop' | 'mobile';
}

export interface State {
  mode: 'site' | 'admin';
  config: Config;
  leads: Lead[];
  chats: Chat[];
  events: TrackEvent[];
  visitor: Visitor;
  sim: Sim;
  open: OpenPanel;
  popup: PopupState | null;
  activeChatId: string | null;
  notices: Notice[];
  staff: Staff[];
  role: Role;
  userId: string;
  leadSeq: number;
  /** Последние отправки для защиты от повторов: digits -> ms */
  recentSubmits: Record<string, number>;
}

function newVisitor(prev?: Visitor): Visitor {
  return {
    id: uid('v_'),
    visits: 1,
    firstSeen: Date.now(),
    utm: {},
    referrer: '',
    device: 'desktop',
    actions: [],
    leadSubmitted: false,
    abAssign: prev?.abAssign ?? {},
    shown: {},
  };
}

function narrowScreen() {
  try {
    return window.matchMedia('(max-width: 700px)').matches;
  } catch {
    return false;
  }
}

const persisted = safeStorage.get<Partial<State> | null>(KEY, null);

const initial: State = {
  mode: 'site',
  config: defaultConfig,
  leads: [],
  chats: [],
  events: [],
  visitor: newVisitor(),
  sim: { path: '/', bnovoDemo: false, frame: narrowScreen() ? 'mobile' : 'desktop' },
  open: null,
  popup: null,
  activeChatId: null,
  notices: [],
  staff: DEMO_STAFF,
  role: 'marketer',
  userId: 'mk',
  leadSeq: 1000,
  recentSubmits: {},
};

function hydrate(): State {
  if (!persisted) return initial;
  const cfg = persisted.config as Config | undefined;
  return {
    ...initial,
    ...persisted,
    // новые поля конфигурации по умолчанию + сохранённые значения
    config: cfg
      ? {
          ...defaultConfig,
          ...cfg,
          widgets: Object.fromEntries(
            Object.entries(defaultConfig.widgets).map(([k, v]) => [
              k,
              { ...v, ...((cfg.widgets as Record<string, object>)?.[k] ?? {}) },
            ]),
          ) as Config['widgets'],
        }
      : defaultConfig,
    open: null,
    popup: null,
    events: [],
    sim: { ...initial.sim, ...(persisted.sim ?? {}), ...(narrowScreen() ? { frame: 'mobile' as const } : {}) },
  };
}

export const useApp = create<State>(() => hydrate());

/** На сайте отеля (embed) заявки и чаты не хранятся в браузере - только на сервере. */
export const storeOptions = { persist: true };

let saveTimer: number | undefined;
useApp.subscribe((s) => {
  if (!storeOptions.persist) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { config, leads, chats, visitor, sim, staff, role, userId, leadSeq, notices, mode } = s;
    // видео (dataURL) может не поместиться в localStorage - сохраняем без него
    const lightConfig = {
      ...config,
      widgets: { ...config.widgets, video: { ...config.widgets.video, src: '' } },
    };
    safeStorage.set(KEY, {
      config: lightConfig,
      leads: leads.slice(0, 300),
      chats: chats.slice(0, 100),
      visitor,
      sim,
      staff,
      role,
      userId,
      leadSeq,
      notices: notices.slice(0, 50),
      mode,
    });
  }, 300);
});

export const set = useApp.setState;
export const get = useApp.getState;

// ---------- Действия ----------

export function setConfig(fn: (c: Config) => Config) {
  set((s) => ({ config: fn(s.config) }));
}

export function patchWidget<K extends keyof Config['widgets']>(id: K, patch: Partial<Config['widgets'][K]>) {
  setConfig((c) => ({ ...c, widgets: { ...c.widgets, [id]: { ...c.widgets[id], ...patch } } }));
}

export function openPanel(p: OpenPanel) {
  set({ open: p });
}

export function addLeadEvent(leadId: string, ev: Omit<LeadEvent, 'at'> & { at?: number }) {
  set((s) => ({
    leads: s.leads.map((l) => (l.id === leadId ? { ...l, history: [...l.history, { at: Date.now(), ...ev }] } : l)),
  }));
}

export function updateLead(leadId: string, patch: Partial<Lead>, note?: string) {
  set((s) => ({
    leads: s.leads.map((l) => {
      if (l.id !== leadId) return l;
      const next = { ...l, ...patch };
      if (!l.firstResponseAt && patch.status && patch.status !== 'new') next.firstResponseAt = Date.now();
      if (note) next.history = [...next.history, { at: Date.now(), kind: 'manager', text: note }];
      return next;
    }),
  }));
}

export function pushNotice(n: Omit<Notice, 'id' | 'at' | 'read'>) {
  set((s) => ({ notices: [{ id: uid('n_'), at: Date.now(), read: false, ...n }, ...s.notices].slice(0, 60) }));
}

export function markVisitorAction(action: string) {
  set((s) =>
    s.visitor.actions.includes(action) ? s : { visitor: { ...s.visitor, actions: [...s.visitor.actions, action] } },
  );
}

export function markShown(key: string) {
  set((s) => ({ visitor: { ...s.visitor, shown: { ...s.visitor.shown, [key]: Date.now() } } }));
}

export function resetVisitor(returning = false) {
  set((s) => {
    const v = newVisitor(s.visitor);
    if (returning) {
      v.id = s.visitor.id;
      v.visits = s.visitor.visits + 1;
      v.firstSeen = s.visitor.firstSeen;
    }
    v.device = s.sim.frame;
    return { visitor: v, open: null, popup: null };
  });
}

export function logEvent(e: Omit<TrackEvent, 'id' | 'at'>) {
  set((s) => ({ events: [{ id: uid('e_'), at: Date.now(), ...e }, ...s.events].slice(0, 200) }));
}

export function ensureChat(): Chat {
  const s = get();
  const existing = s.chats.find((c) => c.visitorId === s.visitor.id);
  if (existing) {
    if (s.activeChatId !== existing.id) set({ activeChatId: existing.id });
    return existing;
  }
  const chat: Chat = {
    id: uid('c_'),
    visitorId: s.visitor.id,
    startedAt: Date.now(),
    demo: true,
    messages: [
      {
        id: uid('m_'),
        at: Date.now(),
        from: 'bot',
        text: s.config.widgets.chat.aiEnabled
          ? s.config.widgets.chat.greeting
          : 'Здравствуйте! Напишите вопрос - администратор ответит в чате.',
      },
    ],
    slots: {},
    mode: s.config.widgets.chat.aiEnabled ? 'ai' : 'waiting_manager',
    unreadForManager: 0,
  };
  set((st) => ({ chats: [chat, ...st.chats], activeChatId: chat.id }));
  return chat;
}

export function patchChat(chatId: string, fn: (c: Chat) => Chat) {
  set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? fn(c) : c)) }));
}

export function addChatMessage(chatId: string, m: Omit<ChatMessage, 'id' | 'at'>): string {
  const id = uid('m_');
  patchChat(chatId, (c) => ({
    ...c,
    messages: [...c.messages, { id, at: Date.now(), ...m }],
    unreadForManager: m.from === 'guest' ? c.unreadForManager + 1 : c.unreadForManager,
  }));
  return id;
}

export function setDelivery(chatId: string, msgId: string, delivery: ChatMessage['delivery']) {
  patchChat(chatId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, delivery } : m)) }));
}

export function widgetEnabled(id: WidgetId) {
  return get().config.widgets[id].enabled;
}

export function resetDemo() {
  safeStorage.del(KEY);
  set({ ...initial, visitor: newVisitor() });
}

/** Переход по страницам сайта. В демо - смена страницы в рамке, на реальном сайте - обычная навигация (переопределяется в embed). */
export const nav = {
  go: (path: string) => set((s) => ({ sim: { ...s.sim, path }, popup: null })),
};
export function navigate(path: string) {
  nav.go(path);
}
