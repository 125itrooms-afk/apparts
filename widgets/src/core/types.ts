// Общие типы: конфигурация виджетов, заявки, чаты, события.

export type WidgetId =
  | 'callback'
  | 'chat'
  | 'multibutton'
  | 'socialProof'
  | 'leadPopup'
  | 'quiz'
  | 'personalization'
  | 'video';

export type Corner = 'right' | 'left';
export type MobileMode = 'show' | 'compact' | 'hide';

export interface PageRule {
  /** '*' - все страницы; иначе префиксы путей через запятую: '/prices, /long-stay' */
  include: string;
  exclude: string;
}

export interface WidgetBase {
  enabled: boolean;
  pages: PageRule;
  mobile: MobileMode;
}

export interface CallbackConfig extends WidgetBase {
  title: string;
  subtitle: string;
  button: string;
  allowSchedule: boolean;
  /** Обещанное время перезвона в рабочие часы, минут */
  promiseMinutes: number;
  showLauncher: boolean;
}

export interface ChatConfig extends WidgetBase {
  greeting: string;
  aiEnabled: boolean;
  quickActions: string[];
  operatorName: string;
  showLauncher: boolean;
}

export type MultiItemId = 'call' | 'callback' | 'chat' | 'quiz' | 'telegram' | 'max' | 'booking' | 'offers';

export interface MultiItem {
  id: MultiItemId;
  label: string;
  enabled: boolean;
}

export interface MultiButtonConfig extends WidgetBase {
  position: Corner;
  color: string;
  animation: 'fan' | 'slide';
  pulse: boolean;
  items: MultiItem[];
}

export interface SocialProofConfig extends WidgetBase {
  firstDelaySec: number;
  intervalSec: number;
  maxPerSession: number;
  displaySec: number;
  hideForReturning: boolean;
  position: Corner;
}

export type TriggerType = 'exit' | 'time' | 'scroll' | 'section' | 'inview' | 'url' | 'utm' | 'action';

export interface Trigger {
  type: TriggerType;
  /** секунды для time/section, % для scroll, подстрока для url/utm, имя действия для action,
   *  для inview - «селектор:секунды», например «#rooms:25» (блок страницы на экране N секунд) */
  value: string;
}

export interface Scenario {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  /** Все условия должны выполниться (И) */
  triggers: Trigger[];
  title: string;
  text: string;
  button: string;
  /** Не показывать чаще, чем раз в N часов одному посетителю */
  capHours: number;
  /** Ссылка на A/B-тест (если есть) */
  abTestId?: string;
}

export interface LeadPopupConfig extends WidgetBase {
  /** Ссылка или dataURL изображения; пусто - фото ресепшна из прототипа */
  image: string;
  minSecondsOnSite: number;
  maxPerSession: number;
  scenarios: Scenario[];
}

export interface QuizConfig extends WidgetBase {
  title: string;
  launcherText: string;
  showInlineOnHome: boolean;
}

export type SegmentConditionType = 'utm_source' | 'utm_campaign' | 'referrer' | 'returning' | 'url' | 'action';

export interface Segment {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: { type: SegmentConditionType; value: string }[];
  headline: string;
  subline: string;
  cta: string;
  abTestId?: string;
}

export interface PersonalizationConfig extends WidgetBase {
  segments: Segment[];
  /** CSS-селекторы элементов сайта, в которые подставляются тексты сегмента (embed) */
  targets: { headline: string; subline: string };
  defaultHeadline: string;
  defaultSubline: string;
  defaultCta: string;
}

export interface VideoConfig extends WidgetBase {
  size: 's' | 'm' | 'l';
  position: Corner;
  title: string;
  ctaPrimary: string;
  ctaSecondary: string;
  /** Ссылка на видео (mp4) или objectURL загруженного; пусто - слайд-шоу из прототипа */
  src: string;
  /** Необязательная WebM-версия того же ролика (лучше сжатие, поддержка Chromium без H.264) */
  srcWebm?: string;
  /** Куда ведёт первая кнопка: путь страницы или якорь (#rooms) */
  ctaPrimaryHref: string;
  delaySec: number;
}

export interface Variant {
  id: string;
  name: string;
  weight: number;
  title: string;
  text: string;
  button: string;
}

export interface ABTest {
  id: string;
  name: string;
  target: 'leadPopup' | 'personalization';
  targetRef: string;
  status: 'draft' | 'running' | 'stopped';
  variants: Variant[];
  goal: 'submit' | 'open';
}

export interface KBEntry {
  id: string;
  topic: string;
  keywords: string;
  answer: string;
  /** Подтверждено отелем. Неподтверждённые ответы в боевом режиме не используются. */
  confirmed: boolean;
}

export interface Contacts {
  phone: string;
  telegram: string;
  max: string;
  bookingUrl: string;
  offersUrl: string;
  privacyUrl: string;
  address: string;
}

export interface WorkHours {
  from: string; // '09:00'
  to: string; // '21:00'
  days: number[]; // 1..7, Пн=1
}

export interface Branding {
  brand: string; // hex
  brandInk: string; // hex текста на бренде
  radius: 'soft' | 'round';
  /** Шрифт текста и заголовков виджетов (берётся с сайта) */
  font: string;
  fontDisplay: string;
  /** Акцент (обводка плавающей кнопки, чтобы она читалась на тёмных блоках сайта) */
  accent: string;
}

/** Как виджеты уживаются с элементами сайта */
export interface Layout {
  /** Ширина экрана, с которой включается мобильная версия, px */
  mobileBreakpoint: number;
  /** Базовый отступ кнопок от нижнего края, px */
  bottomOffset: number;
  /** Плавающие элементы сайта, которые нельзя перекрывать (селекторы). Виджеты поднимаются над ними. */
  avoidSelectors: string[];
}

export type IntegrationId = 'bnovo' | 'bitrix24' | 'metrika' | 'telephony';
export interface IntegrationState {
  id: IntegrationId;
  connected: boolean;
  /** Публичные (не секретные) параметры */
  params: Record<string, string>;
  lastCheck?: string;
}

export interface Config {
  widgets: {
    callback: CallbackConfig;
    chat: ChatConfig;
    multibutton: MultiButtonConfig;
    socialProof: SocialProofConfig;
    leadPopup: LeadPopupConfig;
    quiz: QuizConfig;
    personalization: PersonalizationConfig;
    video: VideoConfig;
  };
  abTests: ABTest[];
  kb: KBEntry[];
  contacts: Contacts;
  hours: WorkHours;
  branding: Branding;
  layout: Layout;
  integrations: IntegrationState[];
  reminders: { firstAfterMin: number; repeatEveryMin: number };
}

// ---------- Заявки ----------

export type LeadStatus = 'new' | 'in_progress' | 'reached' | 'not_reached' | 'booked' | 'rejected';
export type LeadSource = 'callback' | 'chat' | 'quiz' | 'leadPopup' | 'video' | 'multibutton';

export interface LeadEvent {
  at: number;
  kind: 'client' | 'system' | 'manager';
  text: string;
}

export interface Lead {
  id: string;
  num: number;
  createdAt: number;
  demo: boolean;
  source: LeadSource;
  name?: string;
  phone?: string;
  email?: string;
  preferredTime?: string;
  comment?: string;
  status: LeadStatus;
  managerId?: string;
  firstResponseAt?: number;
  lastReminderAt?: number;
  reminders: number;
  refusalReason?: string;
  booking?: { amount: number; nights: number; confirmed: boolean; bnovoId?: string };
  utm: Record<string, string>;
  page: string;
  device: 'desktop' | 'mobile';
  visitorId: string;
  duplicateOf?: string;
  quiz?: Record<string, string>;
  chatId?: string;
  history: LeadEvent[];
  crm: { state: 'not_connected' | 'queued' | 'sent' | 'error'; note: string };
}

// ---------- Чаты ----------

export type Delivery = 'sending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  at: number;
  from: 'guest' | 'bot' | 'manager' | 'system';
  text: string;
  delivery?: Delivery;
  /** Ответ из неподтверждённой записи базы знаний */
  unverified?: boolean;
  actions?: { label: string; action: string; href?: string }[];
}

export interface ChatSlots {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  kids?: number;
  purpose?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
}

export interface Chat {
  id: string;
  visitorId: string;
  startedAt: number;
  demo: boolean;
  messages: ChatMessage[];
  slots: ChatSlots;
  mode: 'ai' | 'waiting_manager' | 'manager';
  managerId?: string;
  unreadForManager: number;
  leadId?: string;
}

// ---------- Аналитика ----------

export type EventName =
  | 'page_view'
  | 'widget_impression'
  | 'widget_open'
  | 'form_start'
  | 'lead_submit'
  | 'booking_click'
  | 'chat_message'
  | 'quiz_step'
  | 'popup_close';

export interface TrackEvent {
  id: string;
  at: number;
  name: EventName;
  widget?: WidgetId;
  data?: Record<string, string | number | boolean>;
  /** Название цели в Яндекс Метрике */
  goal?: string;
}

// ---------- Посетитель (симуляция в демо, реальный контекст в embed) ----------

export interface Visitor {
  id: string;
  visits: number;
  firstSeen: number;
  utm: Record<string, string>;
  referrer: string;
  device: 'desktop' | 'mobile';
  actions: string[];
  leadSubmitted: boolean;
  abAssign: Record<string, string>;
  shown: Record<string, number>; // ключ -> последний показ (ms)
}

export type Role = 'owner' | 'marketer' | 'manager' | 'admin';

export interface Staff {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}
