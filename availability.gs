/**
 * Варшавка 125 — остатки и цены из модуля бронирования → MAX
 * Google Apps Script, версия 3 (цельная). Заменяет весь файл Код.gs.
 *
 * Секреты (MAX_TOKEN, MAX_CHAT_ID) уже лежат в свойствах проекта —
 * setupSecrets() повторно запускать не нужно.
 *
 * Если в проекте есть файл market — в таблицу остатков добавляются
 * минимальные цены конкурентов на ту же дату.
 */

// ==================== НАСТРОЙКИ ====================

var UID = '8fd19a00-9a3e-4978-8ce7-fcb02758f5aa';
var TZ  = 'Europe/Moscow';

// Категории: как узнать в модуле, короткое имя, сколько номеров всего.
// Комфорт и Семейный исправлены по виджету 02.10 (там было 15 и 2 свободных).
// Сумма сейчас 63 — должно быть 66. Проверьте и поправьте.
var CATEGORIES = [
  { match: /престиж/i,      short: 'Престиж',  total: 20 },
  { match: /простор/i,      short: 'Простор',  total: 6  },
  { match: /уют стандарт/i, short: 'Стандарт', total: 12 },
  { match: /уют комфорт/i,  short: 'Комфорт',  total: 15 },
  { match: /люкс/i,         short: 'Люкс',     total: 3  },
  { match: /мини/i,         short: 'Мини',     total: 5  },
  { match: /семейн/i,       short: 'Семейный', total: 2  }
];

// ==================== СЕКРЕТЫ ====================

function setupSecrets() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MAX_TOKEN', 'ЗАПОЛНИТЬ');
  props.setProperty('MAX_CHAT_ID', 'ЗАПОЛНИТЬ');
  Logger.log('Сохранено. Верните значения в коде на ЗАПОЛНИТЬ.');
}

function getSecret(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (!v || v === 'ЗАПОЛНИТЬ') ? null : v;
}

// ==================== ВСПОМОГАТЕЛЬНОЕ ====================

function dayOffset(days) {
  var d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d, f) {
  return Utilities.formatDate(d, TZ, f);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + new Array(n - s.length + 1).join(' ');
}

function money(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function attr(tag, name) {
  var m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
}

function findCategory(title) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].match.test(title)) return CATEGORIES[i];
  }
  return null;
}

var DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// ==================== СБОР ДАННЫХ ====================

function fetchHtml(d1, d2) {
  var url = 'https://reservationsteps.ru/rooms/index/' + UID +
            '?lang=ru&is_auto_search=1' +
            '&dfrom=' + fmt(d1, 'dd-MM-yyyy') +
            '&dto=' + fmt(d2, 'dd-MM-yyyy') + '&adults=2';

  var r = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9'
    }
  });

  if (r.getResponseCode() !== 200) {
    Logger.log('URL: ' + url);
    throw new Error('Модуль бронирования вернул ' + r.getResponseCode());
  }
  return r.getContentText();
}

/**
 * Возвращает { rooms: [...], status: 'ok' | 'closed' | 'unknown' }.
 * closed — модуль явно пишет, что мест нет (распродано или закрыто).
 * unknown — страница пришла, но разметка не распознана: возможно,
 *           модуль поменял вёрстку и парсер надо править.
 */
function parseRooms(html) {
  var tags = html.match(/<select[^>]*selectAvailable[^>]*>/g) || [];
  var byId = {};

  tags.forEach(function (tag) {
    var id    = attr(tag, 'data-room-id');
    var title = attr(tag, 'data-room-type-title');
    var a     = parseInt(attr(tag, 'data-available'), 10);
    var p     = parseInt(attr(tag, 'data-minprice'), 10);
    if (!id || !title || isNaN(a)) return;

    if (!byId[id] || (p && p < byId[id].price)) {
      byId[id] = { title: title, available: a, price: p || null };
    }
  });

  var rooms = Object.keys(byId).map(function (k) { return byId[k]; });
  if (rooms.length) return { rooms: rooms, status: 'ok' };

  // Модуль пишет «Здесь нет свободных мест» в блоке tariff__nodates
  var closed = /tariff__nodates|нет свободных мест/i.test(html);
  return { rooms: [], status: closed ? 'closed' : 'unknown' };
}

/**
 * Данные на одну ночь: по всем категориям, включая распроданные.
 */
function collectNight(offset) {
  var d1 = dayOffset(offset), d2 = dayOffset(offset + 1);
  var parsed = parseRooms(fetchHtml(d1, d2));

  var seen = {};
  var rows = [];
  var unknown = [];

  parsed.rooms.forEach(function (r) {
    var cat = findCategory(r.title);
    if (!cat) { unknown.push(r.title); return; }
    seen[cat.short] = true;
    rows.push({
      name: cat.short,
      left: r.available,
      total: Math.max(cat.total, r.available),
      mismatch: r.available > cat.total,
      price: r.price
    });
  });

  // Чего нет в модуле — распродано или закрыто
  CATEGORIES.forEach(function (cat) {
    if (seen[cat.short]) return;
    rows.push({ name: cat.short, left: 0, total: cat.total, mismatch: false, price: null });
  });

  // Запись в лист raw
  var sheet = getSheet('raw', ['Снято', 'Заезд', 'Категория', 'Осталось',
                               'Всего', 'Цена мин', 'Статус']);
  var stamp = new Date();
  var log = rows.map(function (r) {
    return [stamp, fmt(d1, 'yyyy-MM-dd'), r.name, r.left, r.total,
            r.price || '', r.left === 0 ? 'нет мест' : 'есть'];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, log.length, log[0].length).setValues(log);

  return { date: d1, rows: rows, status: parsed.status, unknown: unknown };
}

// Таблица для логов: та, к которой привязан проект. Если проект не привязан
// к таблице — берём таблицу pickup-отчёта (CFG.SHEET_ID из файла report).
function getSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss && typeof CFG !== 'undefined') ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ==================== ОТЧЁТ ====================

// Экранирование для HTML-разметки MAX
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Минимальные цены конкурентов на ту же ночь (2 гостя).
 * Работает, если в проекте есть файл market (там список отелей).
 * Возвращает строки обычным текстом (без выравнивания) или null.
 *
 *   Рынок, мин. цена:
 *   В125 — 2 660
 *   На Южной — 3 050 (+15%)
 */
function marketBlock(date, ourMin) {
  if (typeof MARKET === 'undefined' || typeof mkBnovo !== 'function') return null;

  var d2 = new Date(date.getTime() + 864e5);
  var lines = ['Рынок, мин. цена:', 'В125 — ' + (ourMin ? money(ourMin) : 'SOLD')];

  MARKET.forEach(function (h) {
    if (h.name === 'В125') return;
    var cell;
    try {
      var rooms = h.type === 'tl' ? mkTravelline(h, date, d2) : mkBnovo(h, date, d2);
      var min = null;
      rooms.forEach(function (r) {
        if (r.avail > 0 && r.price && (min === null || r.price < min)) min = r.price;
      });
      if (min === null) {
        cell = 'SOLD';
      } else {
        cell = money(min);
        if (ourMin) {
          var diff = Math.round((min / ourMin - 1) * 100);
          cell += ' (' + (diff > 0 ? '+' : '') + diff + '%)';
        }
      }
    } catch (e) {
      cell = 'н/д';
      Logger.log(h.name + ': ' + e.message);
    }
    lines.push(h.name + ' — ' + cell);
    Utilities.sleep(800);
  });

  return lines.join('\n');
}

// Сообщение в формате HTML. Таблицу без <pre> и без выравнивания пробелами:
// в веб-версии MAX моноширинный шрифт не включается, и колонки «плывут».
// Одна категория — одна строка: «Люкс — 2/3 · 4 120 ₽».
function buildReport(data) {
  var head = '<b>В125 · ' + DOW[data.date.getDay()] + ' ' + fmt(data.date, 'dd.MM') + '</b>';

  if (data.status === 'unknown') {
    return head + '\nМодуль ответил, но разметка не распознана — нужна проверка парсера.';
  }

  var left = 0, total = 0;
  data.rows.forEach(function (r) {
    left += r.left;
    total += r.total;
  });

  // Наша минимальная цена среди того, что ещё продаётся
  var ourMin = null;
  data.rows.forEach(function (r) {
    if (r.left > 0 && r.price && (ourMin === null || r.price < ourMin)) ourMin = r.price;
  });
  var market = marketBlock(data.date, ourMin);

  if (left === 0) {
    return head + '\nМест к продаже нет (распродано или продажи закрыты).' +
           (market ? '\n\n' + esc(market) : '');
  }

  // Сверху — где непроданная доля больше
  var rows = data.rows.slice().sort(function (a, b) {
    return (b.left / b.total) - (a.left / a.total);
  });

  var t = [];
  rows.forEach(function (r) {
    t.push(esc(r.name) + ' — ' + (r.left === 0
      ? 'SOLD'
      : r.left + '/' + r.total + ' · ' + (r.price ? money(r.price) + ' ₽' : '—')));
  });
  t.push('');
  t.push('<b>Итого — ' + left + '/' + total + ' (' + Math.round(left / total * 100) + '%)</b>');
  if (market) {
    t.push('');
    t.push(esc(market));
  }

  var out = [head, 'Осталось к продаже', ''].concat(t);

  var warn = data.rows.filter(function (r) { return r.mismatch; })
                      .map(function (r) { return r.name; });
  if (warn.length) out.push('⚠ Свободных больше, чем в CATEGORIES: ' + esc(warn.join(', ')));
  if (data.unknown.length) out.push('⚠ Неизвестные категории: ' + esc(data.unknown.join(', ')));

  return out.join('\n');
}

// ==================== MAX ====================

function sendToMax(text) {
  if (!text) {
    Logger.log('Запускайте test_SendToMax() или dailyReport(), не sendToMax().');
    return;
  }
  var token  = getSecret('MAX_TOKEN');
  // Чат маркетологов, если задан (как в pickup-отчёте), иначе основной чат
  var chatId = getSecret('MAX_REPORT_CHAT_ID') || getSecret('MAX_CHAT_ID');
  if (!token || !chatId) {
    Logger.log('MAX не настроен. Сообщение:\n' + text);
    return;
  }

  var url = 'https://platform-api.max.ru/messages?chat_id=' + chatId;
  var body = { text: text.slice(0, 3900), format: 'html' };

  var r = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { 'Authorization': token },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });

  // Если разметка не принята — отправляем простым текстом без тегов
  if (r.getResponseCode() !== 200) {
    Logger.log('HTML не принят (' + r.getResponseCode() + '): ' + r.getContentText());
    delete body.format;
    body.text = body.text.replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { 'Authorization': token },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
  }
  if (r.getResponseCode() !== 200) {
    Logger.log('Ошибка отправки (' + r.getResponseCode() + '): ' + r.getContentText());
  }
}

function getMaxChats() {
  var token = getSecret('MAX_TOKEN');
  if (!token) { Logger.log('Нет токена в свойствах проекта.'); return; }
  var r = UrlFetchApp.fetch('https://platform-api.max.ru/chats', {
    headers: { 'Authorization': token }, muteHttpExceptions: true
  });
  Logger.log(r.getContentText().slice(0, 2000));
}

function test_SendToMax() {
  sendToMax('Проверка связи. Бот подключён.');
}

// ==================== ЗАПУСК ====================

/** Проверка без отправки: результат в журнале. */
function test_ShowAvailability() {
  Logger.log(buildReport(collectNight(0)));
  Utilities.sleep(1500);
  Logger.log(buildReport(collectNight(1)));
}

/** Сводка остатков и цен: сегодня и завтра. Четыре раза в день (см. setupAvailabilityTriggers). */
function availabilityReport() {
  var today = buildReport(collectNight(0));
  Utilities.sleep(1500);
  var tomorrow = buildReport(collectNight(1));
  sendToMax(today + '\n\n' + tomorrow);
}

// Старые имена оставлены, чтобы не сломались прежние триггеры, если их не удалили.
function dailyReport() { availabilityReport(); }
function eveningReport() { availabilityReport(); }

/**
 * Расписание (запустить один раз): сводки в 10:00, 16:00, 20:00 МСК,
 * ночной сбор истории в 3:00. Старые триггеры этих функций удаляются.
 */
function setupAvailabilityTriggers() {
  ['availabilityReport', 'dailyReport', 'eveningReport', 'collectHorizon'].forEach(function (fn) {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
  });
  // Apps Script не запускает точно в минуту: atHour(h).nearMinute(0) — это окно h:00–h:15 МСК.
  [10, 16, 20, 22].forEach(function (h) {
    ScriptApp.newTrigger('availabilityReport').timeBased().everyDays(1)
      .atHour(h).nearMinute(0).inTimezone(TZ).create();
  });
  ScriptApp.newTrigger('collectHorizon').timeBased().everyDays(1)
    .atHour(3).nearMinute(0).inTimezone(TZ).create();
  Logger.log('Триггеры: availabilityReport 10/16/20/22 (окно 15 минут), collectHorizon 3:00 МСК');
}

/**
 * Проверка CATEGORIES.total: сколько номеров категории максимум было
 * свободно за всю историю листа raw. Если больше, чем в CATEGORIES, — total занижен.
 * Сумма CATEGORIES сейчас 63, фонд 66.
 */
function checkTotals() {
  var sh = getSheet('raw', ['Снято', 'Заезд', 'Категория', 'Осталось', 'Всего', 'Цена мин', 'Статус']);
  var last = sh.getLastRow();
  if (last < 2) { Logger.log('raw пуст'); return; }
  var max = {};
  sh.getRange(2, 3, last - 1, 2).getValues().forEach(function (r) {
    max[r[0]] = Math.max(max[r[0]] || 0, Number(r[1]) || 0);
  });
  var sum = 0;
  CATEGORIES.forEach(function (c) {
    sum += c.total;
    Logger.log(c.short + ': в CATEGORIES ' + c.total + ', максимум свободных в истории ' + (max[c.short] || 0));
  });
  Logger.log('Сумма CATEGORIES: ' + sum + ' (фонд 66)');
}

/** История цен и остатков на горизонт вперёд (по умолчанию 21 день). Триггер ночью. */
function collectHorizon() {
  var horizon = (typeof CFG !== 'undefined' && CFG.HORIZON) || 21;
  for (var i = 1; i <= horizon; i++) {
    try {
      collectNight(i);
      Utilities.sleep(1500);
    } catch (e) {
      Logger.log('День +' + i + ': ' + e.message);
    }
  }
}
