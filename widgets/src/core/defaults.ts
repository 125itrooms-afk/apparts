import type { Config, Staff } from './types';

const all = { include: '*', exclude: '' };

/** UID модуля бронирования Bnovo (из availability.gs этого репозитория) */
export const BNOVO_MODULE_UID = '8fd19a00-9a3e-4978-8ce7-fcb02758f5aa';

/**
 * Категории номерного фонда.
 * name, area, maxGuests, levels, fromPrice, note - опубликованы на сайте w125.ru (раздел «Номера»).
 * total - количество номеров из availability.gs (сумма 63, по сайту 66 - сверить с Bnovo).
 * fromPrice - минимальная цена «от» с сайта, а не цена на даты: точная стоимость только из модуля бронирования.
 */
export const CATEGORIES = [
  { key: 'std', name: 'Уют стандарт', total: 12, area: 20, maxGuests: 2, levels: 1, fromPrice: 3050, note: 'Студия с кухней и рабочим столом у окна' },
  { key: 'comfort', name: 'Уют комфорт', total: 15, area: 20, maxGuests: 2, levels: 1, fromPrice: 3350, note: 'Улучшенная студия с барной стойкой, свежий ремонт' },
  { key: 'mini', name: 'Мини', total: 5, area: 18, maxGuests: 2, levels: 2, fromPrice: 3450, note: 'Компактная двухуровневая студия' },
  { key: 'prestige', name: 'Престиж', total: 20, area: 30, maxGuests: 4, levels: 2, fromPrice: 3550, note: 'Спальня на антресоли, внизу гостиная с кухней' },
  { key: 'prostor', name: 'Простор', total: 6, area: 37, maxGuests: 4, levels: 2, fromPrice: 3750, note: 'Самые большие двухуровневые, высокое окно' },
  { key: 'lux', name: 'Люкс', total: 3, area: 30, maxGuests: 3, levels: 2, fromPrice: 3950, note: 'Стиральная и посудомоечная машины, кондиционер' },
  { key: 'family', name: 'Большой семейный', total: 2, area: 45, maxGuests: 6, levels: 2, fromPrice: 5950, note: 'Две студии: 2 кухни и 2 санузла' },
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Категории, подходящие по вместимости (по данным сайта), от дешёвых к дорогим */
export function categoriesFor(guests: number): Category[] {
  return CATEGORIES.filter((c) => c.maxGuests >= guests).sort((a, b) => a.fromPrice - b.fromPrice);
}

export const defaultConfig: Config = {
  widgets: {
    callback: {
      enabled: true,
      pages: all,
      mobile: 'show',
      title: 'Поможем подобрать апартаменты!',
      subtitle: 'Оставьте номер - специалист по бронированию свяжется с вами.',
      button: 'Жду звонка',
      allowSchedule: true,
      promiseMinutes: 10,
      showLauncher: true,
    },
    chat: {
      enabled: true,
      pages: all,
      mobile: 'show',
      greeting:
        'Здравствуйте! 👋 Я помогу подобрать апартаменты на Варшавке 125. Подскажите, на какие даты планируете проживание?',
      aiEnabled: true,
      quickActions: [
        'Подобрать апартаменты',
        'Узнать стоимость',
        'Как добраться?',
        'Ранний заезд / поздний выезд',
        'Командировка',
        'Проживание с детьми',
        'Связаться с администратором',
      ],
      operatorName: 'Администратор Варшавки 125',
      showLauncher: true,
    },
    multibutton: {
      enabled: true,
      pages: all,
      mobile: 'show',
      position: 'right',
      color: '#0B2D2A',
      animation: 'fan',
      pulse: true,
      items: [
        { id: 'call', label: 'Позвонить', enabled: true },
        { id: 'callback', label: 'Заказать обратный звонок', enabled: true },
        { id: 'chat', label: 'Написать в чат', enabled: true },
        { id: 'quiz', label: 'Подобрать номер за 1 минуту', enabled: true },
        { id: 'telegram', label: 'Написать в Telegram', enabled: false },
        { id: 'max', label: 'Написать в MAX', enabled: true },
        { id: 'booking', label: 'Забронировать апартаменты', enabled: true },
        { id: 'offers', label: 'Скидка до 10% на сайте', enabled: true },
      ],
    },
    socialProof: {
      enabled: true,
      pages: { include: '/, /apartments, /prices', exclude: '' },
      mobile: 'compact',
      firstDelaySec: 12,
      intervalSec: 40,
      maxPerSession: 3,
      displaySec: 7,
      hideForReturning: false,
      position: 'left',
    },
    leadPopup: {
      enabled: true,
      pages: { include: '*', exclude: '/contacts' },
      mobile: 'show',
      image: '',
      minSecondsOnSite: 8,
      maxPerSession: 1,
      scenarios: [
        {
          id: 'sc-exit',
          name: 'Уход с сайта',
          enabled: true,
          priority: 10,
          triggers: [{ type: 'exit', value: '' }],
          title: 'Не нашли подходящие апартаменты?',
          text: 'Оставьте контакты - поможем подобрать вариант.',
          button: 'Помогите подобрать',
          capHours: 24,
          abTestId: 'ab-exit',
        },
        {
          id: 'sc-prices',
          name: 'Долго изучает номера и цены',
          enabled: true,
          priority: 20,
          triggers: [{ type: 'inview', value: '#rooms:25' }],
          title: 'Нужна помощь с выбором?',
          text: 'Наш специалист подскажет подходящий вариант проживания.',
          button: 'Получить консультацию',
          capHours: 12,
        },
        {
          id: 'sc-long',
          name: 'Длительное проживание',
          enabled: true,
          priority: 30,
          triggers: [{ type: 'action', value: 'long_stay_interest' }],
          title: 'Планируете остановиться надолго?',
          text: 'Уточните условия длительного размещения.',
          button: 'Узнать условия',
          capHours: 24,
        },
        {
          id: 'sc-corp',
          name: 'Корпоративная реклама',
          enabled: true,
          priority: 40,
          triggers: [
            { type: 'utm', value: 'corp' },
            { type: 'time', value: '15' },
          ],
          title: 'Нужны апартаменты для сотрудников?',
          text: 'Подготовим предложение для вашей компании.',
          button: 'Запросить предложение',
          capHours: 48,
        },
      ],
    },
    quiz: {
      enabled: true,
      pages: all,
      mobile: 'show',
      title: 'Подбор апартаментов за 1 минуту',
      launcherText: 'Подобрать апартаменты',
      showInlineOnHome: true,
    },
    personalization: {
      enabled: true,
      pages: all,
      mobile: 'show',
      defaultHeadline: 'Апартаменты с кухней на Варшавском шоссе',
      defaultSubline: 'Студии и двухуровневые номера: кухня и свой санузел в каждом, бесплатная парковка, 15 минут до м. «Южная».',
      defaultCta: 'Подобрать апартаменты',
      targets: { headline: '', subline: '' },
      segments: [
        {
          id: 'seg-return',
          name: 'Повторный посетитель',
          priority: 10,
          enabled: true,
          conditions: [{ type: 'returning', value: '' }],
          headline: 'Рады видеть вас снова!',
          subline: 'Продолжим подбор? Ваши ответы сохранены.',
          cta: 'Продолжить подбор',
        },
        {
          id: 'seg-corp',
          name: 'Корпоративный сегмент',
          priority: 20,
          enabled: true,
          conditions: [{ type: 'utm_campaign', value: 'corp' }],
          headline: 'Размещение сотрудников и командированных',
          subline: 'Подтверждение проживания и чеки для бухгалтерии к дню выезда, рабочий стол и бесплатная парковка.',
          cta: 'Запросить предложение',
          abTestId: 'ab-corp',
        },
        {
          id: 'seg-family',
          name: 'Семейная аудитория',
          priority: 30,
          enabled: true,
          conditions: [{ type: 'utm_campaign', value: 'family' }],
          headline: 'Подберём комфортное размещение для семьи',
          subline: 'Двухуровневые номера: дети спят наверху, взрослые внизу. «Большой семейный» - до 6 гостей.',
          cta: 'Подобрать для семьи',
        },
        {
          id: 'seg-search',
          name: 'Поисковый трафик',
          priority: 40,
          enabled: true,
          conditions: [{ type: 'referrer', value: 'yandex' }],
          headline: 'Подберём апартаменты на ваши даты',
          subline: 'Укажите даты - покажем доступные категории.',
          cta: 'Выбрать даты',
        },
      ],
    },
    video: {
      enabled: true,
      pages: { include: '/, /apartments', exclude: '' },
      mobile: 'compact',
      size: 'm',
      position: 'left',
      title: 'Апартаменты Варшавки 125',
      ctaPrimaryHref: '/apartments',
      ctaPrimary: 'Посмотреть апартаменты',
      ctaSecondary: 'Забронировать',
      src: '',
      delaySec: 3,
    },
  },
  abTests: [
    {
      id: 'ab-exit',
      name: 'Exit-окно: помощь vs. подбор',
      target: 'leadPopup',
      targetRef: 'sc-exit',
      status: 'running',
      goal: 'submit',
      variants: [
        {
          id: 'A',
          name: 'A (контроль)',
          weight: 50,
          title: 'Не нашли подходящие апартаменты?',
          text: 'Оставьте контакты - поможем подобрать вариант.',
          button: 'Помогите подобрать',
        },
        {
          id: 'B',
          name: 'B',
          weight: 50,
          title: 'Подберём апартаменты за вас',
          text: 'Оставьте телефон - пришлём 2-3 подходящих варианта на ваши даты.',
          button: 'Получить варианты',
        },
      ],
    },
    {
      id: 'ab-corp',
      name: 'Заголовок для корпоративных клиентов',
      target: 'personalization',
      targetRef: 'seg-corp',
      status: 'draft',
      goal: 'submit',
      variants: [
        {
          id: 'A',
          name: 'A (контроль)',
          weight: 50,
          title: 'Размещение сотрудников и командированных',
          text: 'Закрывающие документы, безналичная оплата, долгосрочные условия.',
          button: 'Запросить предложение',
        },
        {
          id: 'B',
          name: 'B',
          weight: 50,
          title: 'Апартаменты для команды - один договор',
          text: 'Поселим сотрудников на любой срок и подготовим документы для бухгалтерии.',
          button: 'Получить КП',
        },
      ],
    },
  ],
  kb: [
    {
      id: 'kb-checkin',
      topic: 'Заезд, выезд, ранний заезд',
      keywords: 'ранний,поздний,во сколько,время заезда,время выезда,заселение,checkin,чекин,раньше,позже',
      answer:
        'Заезд с 15:00, выезд до 12:00. Ранний заезд и поздний выезд возможны по согласованию, с почасовой оплатой. Лучше предупредить хотя бы за сутки.',
      confirmed: true,
    },
    {
      id: 'kb-address',
      topic: 'Адрес и как добраться',
      keywords: 'адрес,добраться,доехать,метро,где,находитесь,как добраться,проехать,южная,вход,секция',
      answer:
        'Москва, Варшавское шоссе, 125, стр. 1, секция 9. От метро «Южная» около 15 минут пешком по Варшавскому шоссе. Вход через секцию 9, перед заездом пришлём схему, как пройти от метро, остановки и парковки.',
      confirmed: true,
    },
    {
      id: 'kb-parking',
      topic: 'Парковка',
      keywords: 'парковка,машина,авто,припарковаться,стоянка',
      answer: 'Да, бесплатная парковка у входа.',
      confirmed: true,
    },
    {
      id: 'kb-breakfast',
      topic: 'Завтрак',
      keywords: 'завтрак,питание,еда,поесть,кафе',
      answer:
        'Есть готовые завтраки шоковой заморозки: разогреваете на своей кухне за несколько минут. Заказать можно при бронировании или на ресепшене. Через дорогу «Перекрёсток», в соседнем подъезде кафе с бизнес-ланчами.',
      confirmed: true,
    },
    {
      id: 'kb-business',
      topic: 'Командировки и документы',
      keywords: 'командировка,документы,закрывающие,счёт,счет,юрлицо,бухгалтерии,чеки,отчетные,отчётные',
      answer:
        'Готовим подтверждение проживания и чеки для бухгалтерии к дню выезда. Напишите при бронировании, что нужны документы. В номерах кухня и стол для работы, парковка бесплатная.',
      confirmed: true,
    },
    {
      id: 'kb-kids',
      topic: 'Проживание с детьми',
      keywords: 'дети,ребенок,ребёнок,детская,семья,с детьми,семьей,семьёй',
      answer:
        'Да, подходит для семей. Двухуровневые «Престиж» и «Простор» вмещают до 4 гостей, «Большой семейный» до 6: в нём две студии с отдельными кухнями и санузлами.',
      confirmed: true,
    },
    {
      id: 'kb-long',
      topic: 'Длительное проживание',
      keywords: 'долго,длительное,месяц,месяцев,долгосрочно,надолго,неделю',
      answer:
        'Да, можно от суток до нескольких месяцев. Для проживания от недели специалист подберёт номер и тариф: оставьте телефон или напишите нам в MAX.',
      confirmed: true,
    },
    {
      id: 'kb-pets',
      topic: 'Животные',
      keywords: 'животн,собак,кошк,питом,кот',
      answer: 'Можно с животными по согласованию с администратором. Стоимость - 3 000 ₽ за проживание.',
      confirmed: true,
    },
    {
      id: 'kb-pay',
      topic: 'Оплата и отмена',
      keywords: 'оплат,отмен,вернуть,предоплат,платить',
      answer:
        'Оплата онлайн в модуле бронирования. На основных тарифах отмена бесплатная, условия показаны рядом с ценой.',
      confirmed: true,
    },
    {
      id: 'kb-reception',
      topic: 'Ресепшн и связь',
      keywords: 'ресепшн,ресепшен,администратор работает,контакт-центр,круглосуточно,телефон',
      answer: 'Ресепшн открыт с 10:00 до 22:00, контакт-центр отвечает круглосуточно: +7 (999) 576-25-10 и MAX.',
      confirmed: true,
    },
    {
      id: 'kb-prices',
      topic: 'Цены',
      keywords: 'цен,стоим,сколько стоит,прайс,тариф,почем,скидк',
      answer:
        'Цены от 3 050 ₽ за ночь («Уют стандарт»), при бронировании на сайте скидка до 10%. Цена зависит от дат и загрузки, точную стоимость показывает модуль бронирования.',
      confirmed: true,
    },
  ],
  contacts: {
    phone: '+7 (999) 576-25-10',
    telegram: '',
    max: 'https://max.ru/u/f9LHodD0cOJ9r1f82batp-Yp6mEIoYRwJwVjSEF5AGbhWv2-_-ErxtNsaDQ',
    bookingUrl: `https://reservationsteps.ru/rooms/index/${BNOVO_MODULE_UID}`,
    offersUrl: `https://reservationsteps.ru/rooms/index/${BNOVO_MODULE_UID}`,
    privacyUrl: 'https://varshavka125.tb.ru/politics',
    address: 'Москва, Варшавское шоссе, 125, стр. 1, секция 9',
  },
  // Контакт-центр работает 24/7 (сайт). Слоты «удобного времени» предлагаются с 09:00 до 21:00.
  hours: { from: '00:00', to: '24:00', days: [1, 2, 3, 4, 5, 6, 7] },
  branding: {
    brand: '#0B2D2A',
    brandInk: '#ffffff',
    radius: 'soft',
    font: '"Onest", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Unbounded", "Arial Black", system-ui, sans-serif',
    accent: '#C6A465',
  },
  layout: { mobileBreakpoint: 760, bottomOffset: 20, avoidSelectors: [] },
  integrations: [
    { id: 'bnovo', connected: false, params: { hotelId: '123048', moduleUid: BNOVO_MODULE_UID } },
    { id: 'bitrix24', connected: false, params: { portal: '', pipeline: 'Отдельная воронка бронирований' } },
    { id: 'metrika', connected: false, params: { counterId: '104105573' } },
    { id: 'telephony', connected: false, params: { provider: 'Виртуальная АТС МегаФон' } },
  ],
  reminders: { firstAfterMin: 10, repeatEveryMin: 10 },
};

export const DEMO_STAFF: Staff[] = [
  { id: 'm1', name: 'Менеджер на линии', role: 'manager', active: true },
  { id: 'm2', name: 'Резервный менеджер (DEMO)', role: 'manager', active: false },
  { id: 'm3', name: 'Ресепшн (DEMO)', role: 'manager', active: false },
  { id: 'mk', name: 'Анастасия (DEMO)', role: 'marketer', active: true },
  { id: 'ow', name: 'Руководитель (DEMO)', role: 'owner', active: true },
  { id: 'ad', name: 'Сисадмин (DEMO)', role: 'admin', active: true },
];

export const STATUS_LABEL: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  reached: 'Дозвонились',
  not_reached: 'Не дозвонились',
  booked: 'Забронировано',
  rejected: 'Отказ',
};

export const SOURCE_LABEL: Record<string, string> = {
  callback: 'Обратный звонок',
  chat: 'Чат',
  quiz: 'Квиз',
  leadPopup: 'Генератор заявок',
  video: 'Видеоприветствие',
  multibutton: 'Мультикнопка',
};

export const WIDGET_LABEL: Record<string, string> = {
  callback: 'Обратный звонок',
  chat: 'Онлайн-чат',
  multibutton: 'Мультикнопка',
  socialProof: 'Уведомления о бронированиях',
  leadPopup: 'Генератор заявок',
  quiz: 'Квиз подбора',
  personalization: 'Персонализация',
  video: 'Видеоприветствие',
};

export const REFUSAL_REASONS = [
  'Нет мест на даты',
  'Дорого',
  'Выбрал другой объект',
  'Не берёт трубку',
  'Неактуально',
  'Не подходит категория',
];
