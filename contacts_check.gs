/***** В125: проверка телефонов и почт у сегодняшних заездов → MAX *****
 *
 * Отдельный файл в том же проекте Apps Script, где лежит BNOVO_KEY.
 * Ничего в Bnovo не меняет: только читает брони.
 *
 * Свойства проекта (уже есть): BNOVO_KEY, MAX_TOKEN.
 * Запуск:
 *   ck_preview()       - посмотреть текст в журнале, ничего не отправляя;
 *   ck_run()           - проверить и отправить в чат;
 *   ck_setupTrigger()  - один раз: ежедневно около 18:00.
 */

const CK = {
  BNOVO_ID: 123048,                 // пользователь API Bnovo (не номер аккаунта)
  CHAT_ID: '-70356200341580',       // чат для уведомлений
  HOTEL: 'В125',
  TZ: 'Europe/Moscow',
  ONLY_CHECKED_IN: false,           // true - только гости со статусом «Заселён»
  SEND_IF_ALL_OK: true,             // слать короткое «всё заполнено»
  WIDE_DAYS: 90,                    // запасной режим: брони, созданные за N дней
  // Кого отметить, когда есть незаполненные контакты. Пример:
  // MENTION: [{ id: 123456789, name: 'Никита' }]
  MENTION: [{ id: 129712540, name: 'Варшавка Reception' }] // имя точно как в профиле MAX
};

/* ---------- ЗАПУСК ---------- */

function ck_run() {
  const text = ck_build_();
  if (text) ck_send_(text);
}

function ck_preview() {
  Logger.log(ck_build_() || '(отправлять нечего)');
}

function ck_setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'ck_run') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ck_run').timeBased().everyDays(1)
    .atHour(18).nearMinute(0).inTimezone(CK.TZ).create();
  Logger.log('Триггер поставлен: ежедневно около 18:00 МСК');
}

/* ---------- ПРОВЕРКА ---------- */

function ck_build_() {
  const today = Utilities.formatDate(new Date(), CK.TZ, 'yyyy-MM-dd');
  const all = ck_bookingsForArrival_(today);

  const arrivals = all.filter(b => {
    const st = b.status || {};
    if (String(st.id) === '2' || /отмен/i.test(st.name || '')) return false;
    if (CK.ONLY_CHECKED_IN && !/засел|прожив/i.test(st.name || '')) return false;
    return true;
  });

  const bad = [];
  arrivals.forEach(b => {
    const c = b.customer || {};
    const issues = [];
    const digits = String(c.phone || '').replace(/\D/g, '');
    if (!digits) issues.push('нет телефона');
    else if (digits.length < 10) issues.push('неполный телефон');
    const email = String(c.email || '').trim();
    if (!email) issues.push('нет почты');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('ошибка в почте');
    if (issues.length) bad.push({ b, c, issues });
  });

  const dd = today.slice(8, 10) + '.' + today.slice(5, 7);
  const head = '**' + CK.HOTEL + ' · заезды ' + dd + ' · контакты гостей**';

  if (!arrivals.length) return CK.SEND_IF_ALL_OK ? head + '\nЗаездов сегодня нет.' : '';
  if (!bad.length) {
    return CK.SEND_IF_ALL_OK
      ? head + '\nВсе ' + arrivals.length + ' броней: телефон и почта заполнены.' : '';
  }

  const tags = (CK.MENTION || []).filter(m => m && m.id)
    .map(m => '[' + ck_esc_(m.name || 'администратор') + '](max://user/' + m.id + ')');
  const lines = [head, (tags.length ? tags.join(', ') + ', ' : '') +
                 'не заполнено: ' + bad.length + ' из ' + arrivals.length, ''];
  bad.sort((x, y) => String(x.b.room_name || '').localeCompare(String(y.b.room_name || ''), 'ru', { numeric: true }))
     .forEach(x => {
       const name = [x.c.surname, x.c.name].filter(Boolean).join(' ') || 'гость без имени';
       const room = x.b.room_name ? 'ном. ' + x.b.room_name : 'без номера';
       const src = ck_short_((x.b.source || {}).name || '');
       const st = (x.b.status || {}).name || '';
       lines.push('• ' + ck_esc_(name) + ', ' + room + ' (' + ck_esc_(src) + ', ' + ck_esc_(st) + ')');
       lines.push('  ' + x.issues.join(', ') + ' · бронь ' + ck_esc_(x.b.number || x.b.id));
     });
  return lines.join('\n').slice(0, 3900);
}

/**
 * Брони с заездом в указанный день.
 * Сначала пробуем узкий запрос на сутки (сегодня → завтра). Если Bnovo фильтрует по дате
 * создания (тогда в ответе только брони, созданные сегодня), переходим
 * на широкий запрос за CK.WIDE_DAYS дней и сами отбираем заезды.
 */
function ck_bookingsForArrival_(day) {
  const token = ck_bnovoToken_();
  const isArrival = b => String(((b.dates || {}).arrival) || '').slice(0, 10) === day;

  // Bnovo требует, чтобы date_to был позже date_from: берём сутки «сегодня → завтра»
  const next = Utilities.formatDate(new Date(new Date(day + 'T12:00:00+03:00').getTime() + 864e5), CK.TZ, 'yyyy-MM-dd');
  const narrow = ck_fetchAll_(token, day, next);
  const createdEarlier = narrow.some(b => String(((b.dates || {}).create_date) || '').slice(0, 10) < day);
  if (createdEarlier) return narrow.filter(isArrival);

  const from = Utilities.formatDate(new Date(Date.now() - CK.WIDE_DAYS * 864e5), CK.TZ, 'yyyy-MM-dd');
  const wide = ck_fetchAll_(token, from, next);
  const seen = {};
  return wide.concat(narrow).filter(b => {
    if (!isArrival(b) || seen[b.id]) return false;
    seen[b.id] = true;
    return true;
  });
}

function ck_fetchAll_(token, from, to) {
  const out = [];
  let offset = 0, portion;
  do {
    const url = 'https://api.pms.bnovo.ru/api/v1/bookings?date_from=' + from +
                '&date_to=' + to + '&limit=50&offset=' + offset;
    const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token },
                                      muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) {
      throw new Error('Bnovo ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    }
    const body = JSON.parse(r.getContentText());
    portion = (body.data && body.data.bookings) || body.bookings || [];
    portion.forEach(b => out.push(b));
    offset += 50;
    Utilities.sleep(250);
  } while (portion.length === 50);
  return out;
}

function ck_bnovoToken_() {
  const pwd = (PropertiesService.getScriptProperties().getProperty('BNOVO_KEY') || '').trim();
  if (!pwd) throw new Error('Нет BNOVO_KEY в свойствах проекта');
  const r = UrlFetchApp.fetch('https://api.pms.bnovo.ru/api/v1/auth', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ id: CK.BNOVO_ID, password: pwd }), muteHttpExceptions: true });
  const t = ((JSON.parse(r.getContentText()) || {}).data || {}).access_token;
  if (!t) throw new Error('Bnovo не выдал токен: ' + r.getResponseCode());
  return t;
}

/* ---------- MAX ---------- */

function ck_send_(text) {
  const token = PropertiesService.getScriptProperties().getProperty('MAX_TOKEN');
  if (!token || token === 'ЗАПОЛНИТЬ') throw new Error('Нет MAX_TOKEN в свойствах проекта');
  const url = 'https://platform-api.max.ru/messages?chat_id=' + encodeURIComponent(CK.CHAT_ID);
  const post = body => UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: token }, payload: JSON.stringify(body), muteHttpExceptions: true });

  let r = post({ text: text, format: 'markdown' });
  if (r.getResponseCode() !== 200) {
    r = post({ text: text.replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\\([*_\[\]`])/g, '$1') });
  }
  Logger.log('MAX: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  if (r.getResponseCode() !== 200) throw new Error('MAX ответил ' + r.getResponseCode());
}

/* ---------- ВСПОМОГАТЕЛЬНОЕ ---------- */

function ck_esc_(s) {
  // экранируем символы разметки markdown в именах гостей и т.п.
  return String(s).replace(/([*_\[\]`])/g, '\\$1');
}

function ck_short_(s) {
  return String(s).replace(/ Путешествия \(новая версия\)/g, '').replace(/ \(новая версия\)/g, '')
    .replace(/Модуль бронирования/g, 'Сайт').replace(/\.(com|ru|рф)\b/gi, '') || 'Прямое';
}
