import { track } from './analytics';
import { bnovoSource, bookingUrl, getOffers } from './integrations';
import { submitLead } from './leads';
import { addChatMessage, get, patchChat, pushNotice, setDelivery } from './store';
import type { Chat, ChatMessage, ChatSlots, KBEntry } from './types';
import { isoDate, isValidEmail, isValidPhone, maskPhone, money, nightsBetween, ruDate } from './util';

/**
 * DEMO-движок консультанта: извлечение слотов (даты, гости, цель, контакты) правилами
 * + ответы ТОЛЬКО из базы знаний. Никаких выдуманных цен и наличия.
 * В проде этот модуль заменяется вызовом POST /api/chat/:id/reply, где LLM получает
 * базу знаний и инструменты (get_availability, create_lead, handoff) и не может
 * ответить фактом, которого нет в базе или в ответе Bnovo.
 */

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

function monthIndex(word: string): number {
  const w = word.toLowerCase();
  // «ма» должно совпасть только с «мая/май», а не с «марта»
  if (/^ма[яй]/.test(w)) return 4;
  return MONTHS.findIndex((m, i) => i !== 4 && w.startsWith(m));
}

function mkDate(day: number, month: number, year?: number): Date {
  const now = new Date();
  const d = new Date(year ?? now.getFullYear(), month, day);
  if (!year && d.getTime() < now.getTime() - 86400000) d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function parseDates(text: string, base?: ChatSlots): { checkIn?: string; checkOut?: string } {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  let inD: Date | undefined;
  let outD: Date | undefined;

  // 12.11 - 15.11 / 12.11.2026-15.11.2026
  const num = [...t.matchAll(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/g)];
  if (num.length) {
    const toD = (m: RegExpMatchArray) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
      return mkDate(Number(m[1]), Number(m[2]) - 1, y);
    };
    inD = toD(num[0]);
    if (num[1]) outD = toD(num[1]);
  }

  // «с 12 по 15 ноября», «12-15 ноября», «12 ноября - 15 ноября»
  if (!inD) {
    const range = t.match(/(\d{1,2})\s*(?:([а-я]+)\s*)?(?:-|-|по|до)\s*(\d{1,2})\s+([а-я]+)/);
    if (range && monthIndex(range[4]) >= 0) {
      const m2 = monthIndex(range[4]);
      const m1 = range[2] && monthIndex(range[2]) >= 0 ? monthIndex(range[2]) : m2;
      inD = mkDate(Number(range[1]), m1);
      outD = mkDate(Number(range[3]), m2);
      if (outD <= inD) outD.setFullYear(outD.getFullYear() + 1);
    } else {
      const single = t.match(/(\d{1,2})\s+([а-я]+)/);
      if (single && monthIndex(single[2]) >= 0) inD = mkDate(Number(single[1]), monthIndex(single[2]));
    }
  }

  if (!inD) {
    if (/послезавтра/.test(t)) inD = add(today, 2);
    else if (/завтра/.test(t)) inD = add(today, 1);
    else if (/сегодня/.test(t)) inD = today;
    else if (/выходн/.test(t)) {
      const dow = today.getDay();
      const toFri = (5 - dow + 7) % 7 || (dow === 5 ? 0 : 7);
      inD = add(today, toFri);
      outD = add(inD, 2);
    }
  }

  const baseIn = inD ?? (base?.checkIn ? new Date(base.checkIn) : undefined);
  if (baseIn && !outD) {
    const n = t.match(/(\d{1,3})\s*(ноч|сут|дн|ден)/);
    if (n) outD = add(baseIn, Number(n[1]));
    else if (/недел/.test(t)) outD = add(baseIn, 7);
    else if (/месяц/.test(t)) outD = add(baseIn, 30);
  }
  return { checkIn: inD ? isoDate(inD) : undefined, checkOut: outD ? isoDate(outD) : undefined };
}

const WORD_NUM: Record<string, number> = {
  один: 1, одна: 1, одного: 1, вдвоем: 2, двое: 2, двоих: 2, втроем: 3, трое: 3, троих: 3,
  вчетвером: 4, четверо: 4, четверых: 4, впятером: 5, пятеро: 5,
};

export function parseGuests(text: string): { guests?: number; kids?: number } {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  let guests: number | undefined;
  let kids: number | undefined;
  const g = t.match(/(\d{1,2})\s*(взросл|человек|чел|гост|персон)/) || t.match(/нас\s+(\d{1,2})/);
  if (g) guests = Number(g[1]);
  for (const [w, n] of Object.entries(WORD_NUM)) if (new RegExp(`(^|\\s)${w}(\\s|$|[,.!])`).test(t)) guests ??= n;
  const k = t.match(/(\d)\s*(дет|ребен|ребят)/);
  if (k) kids = Number(k[1]);
  else if (/с ребенком|с дочкой|с сыном/.test(t)) kids = 1;
  else if (/с детьми/.test(t)) kids = 2;
  if (kids && guests === undefined) guests = 2;
  return { guests, kids };
}

export function parsePurpose(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/командир|по работе|рабоч|для сотрудник|юрлиц/.test(t)) return 'Командировка';
  if (/месяц|надолго|длительн|долгосроч/.test(t)) return 'Длительное проживание';
  if (/дет|семь|ребен|ребён/.test(t)) return 'Семейная поездка';
  if (/отдых|туризм|погулять|выходн|концерт|экскурс/.test(t)) return 'Отдых';
  return undefined;
}

function findKB(text: string): KBEntry | undefined {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  let best: { e: KBEntry; score: number } | undefined;
  for (const e of get().config.kb) {
    const score = e.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k && t.includes(k)).length;
    if (score && (!best || score > best.score)) best = { e, score };
  }
  return best?.e;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Колбэк индикатора печати - назначает виджет чата */
export const typing = { set: (_chatId: string, _on: boolean) => {} };

async function botSay(chatId: string, m: Omit<ChatMessage, 'id' | 'at' | 'from'>) {
  typing.set(chatId, true);
  await sleep(600 + Math.min(1400, m.text.length * 12));
  typing.set(chatId, false);
  addChatMessage(chatId, { from: 'bot', ...m });
}

function chatOf(id: string): Chat | undefined {
  return get().chats.find((c) => c.id === id);
}

function markGuestRead(chatId: string) {
  patchChat(chatId, (c) => ({
    ...c,
    messages: c.messages.map((m) => (m.from === 'guest' && m.delivery !== 'read' ? { ...m, delivery: 'read' } : m)),
  }));
}

export function handoff(chatId: string, reason: string) {
  patchChat(chatId, (c) => ({ ...c, mode: 'waiting_manager' }));
  pushNotice({ text: `Чат: гость ждёт администратора (${reason})`, chatId });
  const hoursOk = (() => {
    const h = get().config.hours;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = h.from.split(':').map(Number);
    const [th, tm] = h.to.split(':').map(Number);
    return cur >= fh * 60 + fm && cur < th * 60 + tm;
  })();
  addChatMessage(chatId, {
    from: 'system',
    text: hoursOk
      ? 'Передал диалог администратору. Он ответит здесь же. Можно оставить телефон - перезвоним.'
      : `Передал диалог администратору. Сейчас нерабочее время - ответим с ${get().config.hours.from}. Оставьте телефон, чтобы мы не потеряли ваш вопрос.`,
    actions: [{ label: 'Оставить телефон', action: 'ask_phone' }],
  });
}

async function proposeNext(chatId: string): Promise<void> {
  const c = chatOf(chatId);
  if (!c) return;
  const s = c.slots;
  if (!s.checkIn) return botSay(chatId, { text: 'На какие даты планируете проживание? Например: «с 12 по 15 ноября» или «12.11-15.11».' });
  if (!s.checkOut)
    return botSay(chatId, { text: `Заезд ${ruDate(s.checkIn)}. На сколько ночей или до какой даты?` });
  if (!s.guests) return botSay(chatId, { text: 'Сколько будет гостей? Если с детьми - напишите, сколько детей.' });
  if (!s.purpose)
    return botSay(chatId, {
      text: 'Подскажите цель поездки - так подберу подходящий вариант.',
      actions: ['Отдых', 'Командировка', 'Семейная поездка', 'Длительное проживание'].map((p) => ({
        label: p,
        action: 'purpose:' + p,
      })),
    });
  return showOffers(chatId);
}

async function showOffers(chatId: string): Promise<void> {
  const c = chatOf(chatId);
  if (!c?.slots.checkIn || !c.slots.checkOut) return proposeNext(chatId);
  const { checkIn, checkOut, guests = 2 } = c.slots;
  const nights = nightsBetween(checkIn, checkOut);
  const link = bookingUrl(checkIn, checkOut, guests);
  const kind = bnovoSource();
  if (kind === 'none') {
    return botSay(chatId, {
      text:
        `Записал: ${ruDate(checkIn)}-${ruDate(checkOut)} (${nights} ноч.), гостей: ${guests}. ` +
        'Актуальные цены и свободные апартаменты на эти даты покажет модуль бронирования - я передам туда ваши даты. ' +
        'Или оставьте телефон: специалист подберёт вариант и перезвонит.',
      actions: [
        { label: 'Открыть бронирование с датами', action: 'booking', href: link },
        { label: 'Оставить телефон', action: 'ask_phone' },
      ],
    });
  }
  typing.set(chatId, true);
  let offers;
  try {
    offers = await getOffers(checkIn, checkOut, guests);
  } catch {
    typing.set(chatId, false);
    return botSay(chatId, {
      text: 'Не удалось получить наличие из системы бронирования. Передаю вопрос администратору.',
      actions: [{ label: 'Оставить телефон', action: 'ask_phone' }],
    });
  }
  typing.set(chatId, false);
  const avail = (offers ?? []).filter((o) => o.available > 0);
  if (!avail.length) {
    return botSay(chatId, {
      text: `На ${ruDate(checkIn)}-${ruDate(checkOut)} для ${guests} гостей свободных апартаментов в системе нет. Специалист может предложить соседние даты.`,
      actions: [{ label: 'Оставить телефон', action: 'ask_phone' }],
    });
  }
  const lines = avail
    .slice(0, 4)
    .map((o) => `• ${o.name}${o.price ? ` - ${money(o.price)} за ${nights} ноч.` : ''}`)
    .join('\n');
  return botSay(chatId, {
    text: `${kind === 'demo' ? '[DEMO-данные Bnovo]\n' : ''}На ${ruDate(checkIn)}-${ruDate(checkOut)} доступны:\n${lines}\nЦены из системы бронирования на момент запроса.`,
    unverified: kind === 'demo',
    actions: [
      { label: 'Перейти к бронированию', action: 'booking', href: link },
      { label: 'Нужна помощь специалиста', action: 'ask_phone' },
    ],
  });
}

export async function handleGuestMessage(chatId: string, text: string) {
  const msgId = addChatMessage(chatId, { from: 'guest', text, delivery: 'sending' });
  track('chat_message', 'chat');
  await sleep(250);
  setDelivery(chatId, msgId, 'sent');
  await sleep(350);
  setDelivery(chatId, msgId, 'delivered');

  const chat = chatOf(chatId);
  if (!chat) return;
  const cfg = get().config.widgets.chat;

  // Контакты в сообщении
  const phoneMatch = text.match(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/);
  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
  if (phoneMatch || emailMatch) {
    patchChat(chatId, (c) => ({
      ...c,
      slots: {
        ...c.slots,
        phone: phoneMatch && isValidPhone(phoneMatch[0]) ? maskPhone(phoneMatch[0]) : c.slots.phone,
        email: emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : c.slots.email,
      },
    }));
  }

  if (chat.mode !== 'ai' || !cfg.aiEnabled) {
    if (chat.mode === 'ai') handoff(chatId, 'ИИ отключён');
    else pushNotice({ text: 'Новое сообщение в чате от гостя', chatId });
    if (phoneMatch || emailMatch) askConsent(chatId);
    return;
  }

  markGuestRead(chatId);
  const t = text.toLowerCase();

  // Слоты
  const dates = parseDates(text, chat.slots);
  const g = parseGuests(text);
  const purpose = parsePurpose(text);
  patchChat(chatId, (c) => ({
    ...c,
    slots: {
      ...c.slots,
      ...(dates.checkIn ? { checkIn: dates.checkIn } : {}),
      ...(dates.checkOut ? { checkOut: dates.checkOut } : {}),
      ...(g.guests ? { guests: g.guests } : {}),
      ...(g.kids !== undefined ? { kids: g.kids } : {}),
      ...(purpose && !c.slots.purpose ? { purpose } : {}),
    },
  }));

  if (phoneMatch || emailMatch) return askConsent(chatId);

  if (/администратор|оператор|менеджер|живым|живой человек|связаться/.test(t)) return handoff(chatId, 'запрос гостя');

  // Вопросы по базе знаний
  const kb = findKB(text);
  const askedPrice = /цен|стоим|сколько стоит|прайс|тариф|почем/.test(t);
  const wantsPick = /подобр|забронир|свободн|наличи|номер|апартамент/.test(t);

  if (kb && !askedPrice) {
    const live = get().config.integrations.some((i) => i.connected);
    if (!kb.answer.trim() || (live && !kb.confirmed)) {
      return botSay(chatId, {
        text: `По теме «${kb.topic}» у меня нет подтверждённой информации. Передать вопрос администратору?`,
        actions: [{ label: 'Да, передать', action: 'handoff' }],
      });
    }
    await botSay(chatId, { text: kb.answer, unverified: !kb.confirmed });
    if (dates.checkIn || g.guests) return proposeNext(chatId);
    return;
  }

  if (askedPrice || wantsPick || dates.checkIn || g.guests || purpose) return proposeNext(chatId);

  return botSay(chatId, {
    text: 'Я отвечаю на вопросы о проживании и помогаю подобрать апартаменты. Могу передать вопрос администратору.',
    actions: [
      { label: 'Подобрать апартаменты', action: 'quick:Подобрать апартаменты' },
      { label: 'Связаться с администратором', action: 'handoff' },
    ],
  });
}

function askConsent(chatId: string) {
  const c = chatOf(chatId);
  if (c?.leadId) {
    addChatMessage(chatId, { from: 'system', text: 'Контакты обновлены в заявке.' });
    return;
  }
  return botSay(chatId, {
    text: `Спасибо! Чтобы специалист связался с вами${c?.slots.phone ? ` по номеру ${c.slots.phone}` : ''}, подтвердите согласие на обработку персональных данных.`,
    actions: [{ label: 'Согласен(на) на обработку ПД', action: 'consent' }],
  });
}

export async function handleAction(chatId: string, action: string, label: string) {
  const chat = chatOf(chatId);
  if (!chat) return;
  if (action === 'booking') {
    track('booking_click', 'chat');
    return;
  }
  if (action === 'handoff') return handoff(chatId, 'запрос гостя');
  if (action === 'ask_phone') {
    return botSay(chatId, { text: 'Напишите номер телефона в формате +7 9XX XXX-XX-XX - специалист перезвонит.' });
  }
  if (action.startsWith('purpose:')) {
    const p = action.slice(8);
    patchChat(chatId, (c) => ({ ...c, slots: { ...c.slots, purpose: p } }));
    addChatMessage(chatId, { from: 'guest', text: p, delivery: 'read' });
    return proposeNext(chatId);
  }
  if (action === 'consent') {
    addChatMessage(chatId, { from: 'guest', text: label, delivery: 'read' });
    patchChat(chatId, (c) => ({ ...c, slots: { ...c.slots, consent: true } }));
    const c = chatOf(chatId)!;
    const res = submitLead({
      source: 'chat',
      phone: c.slots.phone,
      email: c.slots.email,
      consent: true,
      chatId,
      comment: [
        c.slots.checkIn && `Даты: ${ruDate(c.slots.checkIn)}-${c.slots.checkOut ? ruDate(c.slots.checkOut) : '?'}`,
        c.slots.guests && `Гостей: ${c.slots.guests}${c.slots.kids ? `, детей: ${c.slots.kids}` : ''}`,
        c.slots.purpose && `Цель: ${c.slots.purpose}`,
      ]
        .filter(Boolean)
        .join('; '),
    });
    if (res.ok) {
      patchChat(chatId, (x) => ({ ...x, leadId: res.lead.id }));
      const h = get().config;
      return botSay(chatId, {
        text: `Готово, заявка №${res.lead.num} создана. Специалист свяжется с вами ${
          isWorkingNow() ? `в течение ${h.widgets.callback.promiseMinutes} минут` : `в рабочее время, с ${h.hours.from}`
        }. История переписки сохранена.`,
      });
    }
    return botSay(chatId, { text: res.error });
  }
  if (action.startsWith('quick:')) {
    const q = action.slice(6);
    return handleQuick(chatId, q);
  }
}

function isWorkingNow() {
  const h = get().config.hours;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = h.from.split(':').map(Number);
  const [th, tm] = h.to.split(':').map(Number);
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  return h.days.includes(dow) && cur >= fh * 60 + fm && cur < th * 60 + tm;
}

export async function handleQuick(chatId: string, q: string) {
  const map: Record<string, string> = {
    'Подобрать апартаменты': 'Хочу подобрать апартаменты',
    'Узнать стоимость': 'Сколько стоит проживание?',
    'Как добраться?': 'Как добраться?',
    'Ранний заезд / поздний выезд': 'Возможен ранний заезд или поздний выезд?',
    Командировка: 'Еду в командировку, нужны документы',
    'Проживание с детьми': 'Мы с детьми',
    'Связаться с администратором': 'Связаться с администратором',
  };
  return handleGuestMessage(chatId, map[q] ?? q);
}

/** Ответ менеджера из панели */
export function managerReply(chatId: string, text: string, managerId: string) {
  patchChat(chatId, (c) => ({ ...c, mode: 'manager', managerId, unreadForManager: 0 }));
  markGuestRead(chatId);
  addChatMessage(chatId, { from: 'manager', text });
}

export function returnToAI(chatId: string) {
  patchChat(chatId, (c) => ({ ...c, mode: 'ai' }));
  addChatMessage(chatId, { from: 'system', text: 'Администратор вернул диалог виртуальному консультанту.' });
}
