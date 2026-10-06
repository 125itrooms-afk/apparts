/**
 * market.gs — В125 против конкурентов: свободные номера и цены.
 *
 * Добавьте как ВТОРОЙ файл в тот же проект Apps Script (кнопка «+» → Скрипт).
 * Использует sendToMax() и getSheet() из основного файла.
 *
 * Запуск: test_Market() — проверка в журнале; marketReport() — отправка в MAX.
 */

// ==================== НАСТРОЙКИ ====================

var MARKET = [
  { name: 'В125',     type: 'bnovo', uid: '8fd19a00-9a3e-4978-8ce7-fcb02758f5aa',
    total: 66, std: /уют стандарт/i },
  { name: 'На Южной', type: 'bnovo', uid: '74d97320-fa29-4dc7-b932-4044d2b4a426',
    total: 32, std: /^стандарт$/i },
  // TravelLine показывает остаток не больше 10 на категорию → «10+»
  { name: 'Norke',    type: 'tl', code: '17720',
    total: null, cap: 10, std: /^студия с одной кроватью$/i }
];

// Какие даты сравниваем: 0 — сегодня, 1 — завтра и т.д.
var MARKET_OFFSETS = [0, 1, 2, 3, 7];

var TL_HOST = 'https://ru-ibe.tlintegration.ru';
var MK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9'
};
var MK_DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// ==================== ВСПОМОГАТЕЛЬНОЕ ====================

function mkDay(offset) {
  var d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function mkFmt(d, f) {
  return Utilities.formatDate(d, 'Europe/Moscow', f);
}

function mkFetch(url) {
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: MK_HEADERS });
  if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
  return r.getContentText();
}

function mkAttr(tag, name) {
  var m = tag.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
}

function mkPad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + new Array(n - s.length + 1).join(' ');
}

// ==================== ИСТОЧНИКИ ====================

/** Модуль Bnovo (reservationsteps.ru): остаток лежит в data-available. */
function mkBnovo(h, d1, d2) {
  var url = 'https://reservationsteps.ru/rooms/index/' + h.uid +
            '?lang=ru&is_auto_search=1' +
            '&dfrom=' + mkFmt(d1, 'dd-MM-yyyy') +
            '&dto=' + mkFmt(d2, 'dd-MM-yyyy') + '&adults=2';

  var tags = mkFetch(url).match(/<select[^>]*selectAvailable[^>]*>/g) || [];
  var rooms = {};

  tags.forEach(function (t) {
    var id    = mkAttr(t, 'data-room-id');
    var title = mkAttr(t, 'data-room-type-title');
    var a     = parseInt(mkAttr(t, 'data-available'), 10);
    var p     = parseInt(mkAttr(t, 'data-minprice'), 10);
    if (!id || !title || isNaN(a)) return;
    if (!rooms[id] || (p && p < rooms[id].price)) {
      rooms[id] = { title: title, avail: a, price: p || null };
    }
  });

  return Object.keys(rooms).map(function (k) { return rooms[k]; });
}

/** Названия категорий TravelLine, кэш на 6 часов. */
function mkTlNames(code) {
  var cache = CacheService.getScriptCache();
  var key = 'tlnames_' + code;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var info = JSON.parse(mkFetch(TL_HOST +
    '/ApiWebDistribution/BookingForm/hotel_info?hotels%5B0%5D.code=' + code +
    '&language=ru-ru&audience=BookingForm'));

  var names = {};
  var types = (info.hotels && info.hotels[0] && info.hotels[0].room_types) || [];
  types.forEach(function (t) { names[t.code] = t.name; });

  cache.put(key, JSON.stringify(names), 21600);
  return names;
}

/** Модуль TravelLine: остаток — в room_type_quotas. */
function mkTravelline(h, d1, d2) {
  var names = mkTlNames(h.code);
  var url = TL_HOST + '/ApiWebDistribution/BookingForm/hotel_availability' +
            '?include_rates=true&include_promo_restricted=true' +
            '&language=ru-ru&audience=BookingForm' +
            '&criterions%5B0%5D.adults=2' +
            '&criterions%5B0%5D.dates=' + mkFmt(d1, 'yyyy-MM-dd') + '%3B' + mkFmt(d2, 'yyyy-MM-dd') +
            '&criterions%5B0%5D.hotels%5B0%5D.code=' + h.code;

  var r = JSON.parse(mkFetch(url));
  var quota = {};
  (r.room_type_quotas || []).forEach(function (q) { quota[q.rph] = q.quantity; });

  var rooms = {};
  (r.room_stays || []).forEach(function (s) {
    (s.room_types || []).forEach(function (t) {
      var p = (s.total && s.total.price_after_tax) ||
              (t.placements || []).reduce(function (a, b) {
                return a + (b.price_after_tax || 0);
              }, 0);
      var a = quota[t.room_type_quota_rph];
      if (a === undefined) a = t.limited_inventory_count || 0;

      if (!rooms[t.code] || p < rooms[t.code].price) {
        rooms[t.code] = { title: names[t.code] || String(t.code), avail: a, price: p };
      }
    });
  });

  return Object.keys(rooms).map(function (k) { return rooms[k]; });
}

// ==================== РАСЧЁТ ====================

function mkSummary(h, rooms) {
  var s = { name: h.name, total: h.total, free: 0, capped: false,
            entry: null, std: null, sold: rooms.length === 0 };

  rooms.forEach(function (r) {
    s.free += r.avail;
    if (h.cap && r.avail >= h.cap) s.capped = true;
    if (r.price && (s.entry === null || r.price < s.entry)) s.entry = r.price;
    if (h.std && h.std.test(r.title.trim()) && r.price &&
        (s.std === null || r.price < s.std)) s.std = r.price;
  });
  return s;
}

function mkMoney(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Одна строка на отель, без выравнивания пробелами (в веб-версии MAX <pre> не моноширинный):
// «В125 — своб. 3/66 · стандарт 3 730»
function mkRow(s) {
  if (s.error) return s.name + ' — нет данных';
  if (s.sold) return s.name + ' — SOLD';
  var free = s.free + (s.capped ? '+' : '') + (s.total ? '/' + s.total : '');
  return s.name + ' — своб. ' + free + ' · стандарт ' + (s.std ? mkMoney(s.std) : '—');
}

/** Подсказки. Решение по цене принимает revenue-менеджер. */
function mkHints(rows) {
  var us = rows[0];
  var comps = rows.slice(1).filter(function (c) { return !c.error; });
  var hints = [];
  if (us.error || !comps.length) return hints;

  var occ = us.total ? (us.total - us.free) / us.total : null;

  var compsSold = comps.filter(function (c) { return c.sold; }).length;
  if (!us.sold && compsSold === comps.length) {
    hints.push('→ у конкурентов мест нет, у нас ' + us.free + ' — повод поднять');
  }

  var stds = comps.filter(function (c) { return c.std; })
                  .map(function (c) { return c.std; });
  if (us.std && stds.length) {
    var avg = stds.reduce(function (a, b) { return a + b; }, 0) / stds.length;
    var idx = us.std / avg;
    var line = '→ индекс цены ' + idx.toFixed(2);
    if (idx < 0.85 && occ !== null && occ >= 0.6) {
      line += ', загрузка ' + Math.round(occ * 100) + '% — дёшево';
    } else if (idx > 1.1 && occ !== null && occ < 0.4) {
      line += ', загрузка ' + Math.round(occ * 100) + '% — дороже рынка';
    }
    hints.push(line);
  }
  return hints;
}

// ==================== ОТЧЁТ ====================

function buildMarketReport() {
  var stamp = new Date();
  var log = [];
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var out = [
    '<b>В125 и рынок</b>',
    'Своб. — свободно номеров, стандарт — цена сопоставимой категории'
  ];

  MARKET_OFFSETS.forEach(function (off) {
    var d1 = mkDay(off), d2 = mkDay(off + 1);

    var rows = MARKET.map(function (h) {
      var s;
      try {
        var rooms = h.type === 'tl' ? mkTravelline(h, d1, d2) : mkBnovo(h, d1, d2);
        s = mkSummary(h, rooms);
      } catch (e) {
        s = { name: h.name, error: e.message };
      }
      log.push([
        stamp, mkFmt(d1, 'yyyy-MM-dd'), h.name,
        s.error ? '' : s.free, h.total || '',
        s.entry || '', s.std || '',
        s.error ? 'ошибка: ' + s.error
                : (s.sold ? 'нет мест' : (s.capped ? 'есть (10+)' : 'есть'))
      ]);
      Utilities.sleep(800);
      return s;
    });

    out.push('');
    out.push('<b>' + MK_DOW[d1.getDay()] + ' ' + mkFmt(d1, 'dd.MM') + '</b>');
    rows.forEach(function (r) { out.push(esc(mkRow(r))); });
    mkHints(rows).forEach(function (h) { out.push(esc(h)); });
  });

  var sheet = getSheet('market',
    ['Снято', 'Дата', 'Отель', 'Свободно', 'Всего', 'Вход', 'Станд', 'Статус']);
  if (log.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, log.length, log[0].length).setValues(log);
  }

  return out.join('\n');
}

function test_Market() {
  Logger.log(buildMarketReport());
}

function marketReport() {
  sendToMax(buildMarketReport());
}
