/***** В125: Bnovo → сводки → pickup-отчёт в MAX (Пн/Ср/Пт) *****
 *
 * Версия от 02.10.2026. Отличия от версии 21.09:
 *  1. «Поднять цену» — только при опережении нормы И загрузке от 70%
 *     (или от 85% без условий). Список отсортирован по дате.
 *  2. Домены каналов (101hotels.com) больше не превращаются в ссылки.
 *  3. Если в проекте есть market.gs — вторым сообщением уходит
 *     сравнение с конкурентами.
 *
 * Свойства проекта: BNOVO_KEY, MAX_TOKEN, MAX_CHAT_ID (вам, алерты),
 * MAX_REPORT_CHAT_ID (чат маркетологов).
 */

const CFG = {
  SHEET_ID: '1loxD_s5S1uQ4dmnVoy1GDjiZfODtCjvAFCCL_0ZrgIY',
  AGG_ID: '1RHzt7_vpO7kfUbKyIHF4Y0vXTwRQNIAt3JDJmZTBOBQ',  // файл B125_agg для анализа
  BNOVO_ID: 123048,
  CAPACITY: 66,          // номерной фонд
  TARGET_OCC: 0.95,      // целевая загрузка на дату заезда
  RISK: 0.75,            // набор ниже 75% нормы → провал
  HOT: 1.25,             // набор выше 125% нормы → перегрев…
  HOT_MIN_OCC: 0.70,     // …но только если загрузка уже от 70%
  HOT_ANY_OCC: 0.85,     // от 85% — поднимать без условий
  HORIZON: 21,           // сколько дней вперёд проверяем
  NETT: {'Bronevik.com (новая версия)': 20},  // каналы с нетто-ценой: % комиссии
  REPORT_MONTHS: 4,      // месяцев броней (по дате создания) для отчёта
  TZ: 'Europe/Moscow'
};

/* ---------- ЗАПУСК ---------- */

// Главная функция: её вызывает расписание
function runReport() {
  try {
    pullNights(monthStarts_(CFG.REPORT_MONTHS));
    aggregate();
    exportAgg();
    sendMaxReport_(buildReport_(), false);
  } catch (e) {
    Logger.log(e);
    try { sendMaxReport_('⚠️ Отчёт В125 не сформирован: ' + e.message, true); } catch (x) {}
    throw e;
  }

  // Конкуренты — отдельным сообщением, если подключён market.gs.
  // Ошибка здесь не ломает основной отчёт.
  if (typeof buildMarketReport === 'function') {
    try {
      sendMaxReport_(buildMarketReport(), false, true);
    } catch (e) {
      Logger.log('Конкуренты: ' + e.message);
      try { sendMaxReport_('⚠️ Блок конкурентов не собран: ' + e.message, true); } catch (x) {}
    }
  }
}

// Посмотреть текст отчёта в журнале, ничего не отправляя
function previewReport() {
  Logger.log(buildReport_());
}

// Разово отправить отчёт по текущим сводкам (без новой выгрузки)
function testSend() {
  sendMaxReport_(buildReport_(), false);
}

// Поставить расписание Пн/Ср/Пт ~8:40 МСК (запускать один раз)
function setupReportTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runReport') ScriptApp.deleteTrigger(t);
  });
  [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.FRIDAY].forEach(function(d) {
    ScriptApp.newTrigger('runReport').timeBased().onWeekDay(d)
      .atHour(8).nearMinute(40).inTimezone(CFG.TZ).create();
  });
  Logger.log('Триггеры поставлены: Пн, Ср, Пт ~8:40 МСК');
}

/* ---------- BNOVO ---------- */

function bnovoToken() {
  const pwd = PropertiesService.getScriptProperties().getProperty('BNOVO_KEY').trim();
  const r = UrlFetchApp.fetch('https://api.pms.bnovo.ru/api/v1/auth', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({id: CFG.BNOVO_ID, password: pwd})});
  return JSON.parse(r.getContentText()).data.access_token;
}

function monthStarts_(n) {
  const p = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM').split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let mm = p[1] - i, yy = p[0];
    while (mm < 1) { mm += 12; yy--; }
    out.push(yy + '-' + String(mm).padStart(2, '0') + '-01');
  }
  return out;
}

// Ручной запуск без аргумента = 6 месяцев (для большого анализа)
function pullNights(months) {
  const MONTHS = Array.isArray(months) ? months : monthStarts_(6);
  const t = bnovoToken();
  const rows = [];

  MONTHS.forEach(function(m) {
    const p = m.split('-').map(Number);
    const end = m.slice(0, 8) + String(new Date(p[0], p[1], 0).getDate()).padStart(2, '0');
    let offset = 0, portion;
    do {
      const url = 'https://api.pms.bnovo.ru/api/v1/bookings?date_from=' + m +
                  '&date_to=' + end + '&limit=50&offset=' + offset;
      const resp = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + t},
                                           muteHttpExceptions: true});
      if (resp.getResponseCode() !== 200) {
        throw new Error('Bnovo ' + resp.getResponseCode() + ' (' + m + ', offset ' + offset + ')');
      }
      const body = JSON.parse(resp.getContentText());
      portion = (body.data && body.data.bookings) || body.bookings || [];
      portion.forEach(function(bk) {
        const src = bk.source || {}, st = bk.status || {}, ex = bk.extra || {}, dt = bk.dates || {};
        (bk.prices || []).forEach(function(pr) {
          rows.push([bk.id, dt.create_date || '', pr.date, pr.room_type_name, pr.price,
                     src.name || '', src.commission || 0, st.name || '',
                     dt.cancel_date || '', ex.adults || '', bk.plan_name || '']);
        });
      });
      offset += 50;
      Utilities.sleep(300);
    } while (portion.length === 50);
    Logger.log(m + ': строк ' + rows.length);
  });

  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const sh = ss.getSheetByName('nights') || ss.insertSheet('nights');
  sh.clear();
  sh.getRange(1, 1, rows.length + 1, 3).setNumberFormat('@');
  sh.getRange(1, 9, rows.length + 1, 1).setNumberFormat('@');
  sh.appendRow(['booking_id','create_date','night','category','price','source',
                'commission','status','cancel_date','adults','plan']);
  if (rows.length) sh.getRange(2, 1, rows.length, 11).setValues(rows);
  Logger.log('ИТОГО строк: ' + rows.length);
}

/* ---------- СВОДКИ ---------- */

function aggregate() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  const data = ss.getSheetByName('nights').getDataRange().getValues();
  data.shift();

  const toD = v => (v instanceof Date) ? v : new Date(String(v).replace(' ', 'T'));
  const fmt = d => Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd');
  const add = (o, k, f, v) => { o[k] = o[k] || {}; o[k][f] = (o[k][f] || 0) + v; };
  const R = Math.round;

  const today = new Date(), wk = new Date(today - 7 * 864e5), half = new Date(today - 180 * 864e5);
  const ch = {}, cat = {}, daily = {}, pick = {}, otb = {}, canc = {};

  data.forEach(function(r) {
    const nt = r[2], category = r[3], price = Number(r[4]) || 0;
    const source = r[5] || 'н/д', commPct = Number(r[6]) || 0;
    if (!nt || !price) return;
    const night = toD(nt), created = toD(r[1]), cd = r[8] ? toD(r[8]) : null;
    const nk = fmt(night), mk = nk.slice(0, 7), live = !cd;

    const nettPct = CFG.NETT[source];
    const gross = nettPct ? price / (1 - nettPct / 100) : price;
    const comm = nettPct ? gross - price : price * commPct / 100;
    const net = gross - comm;

    const lead = R((night - created) / 864e5);
    const bucket = lead <= 0 ? '0 дней' : lead <= 3 ? '1-3' : lead <= 7 ? '4-7' :
                   lead <= 14 ? '8-14' : lead <= 30 ? '15-30' : '31+';

    if (live) {
      const ck = source + '|' + mk, ak = category + '|' + mk;
      add(ch, ck, 'n', 1); add(ch, ck, 'gross', gross); add(ch, ck, 'comm', comm); add(ch, ck, 'net', net);
      add(cat, ak, 'n', 1); add(cat, ak, 'gross', gross);
      add(daily, nk, 'n', 1); add(daily, nk, 'gross', gross); add(daily, nk, 'net', net);
      add(pick, mk + '|' + bucket, 'n', 1);
    } else {
      add(ch, source + '|' + mk, 'cn', 1); add(ch, source + '|' + mk, 'csum', gross);
      add(cat, category + '|' + mk, 'cn', 1);
      if (cd >= half) {
        const dk = fmt(cd);
        add(canc, dk, 'n', 1); add(canc, dk, 'sum', gross);
        canc[dk].by = canc[dk].by || {};
        canc[dk].by[source] = (canc[dk].by[source] || 0) + 1;
      }
    }
    if (night >= today) {
      if (live) { add(otb, nk, 'now_n', 1); add(otb, nk, 'now_rev', gross); }
      if (created <= wk && (!cd || cd > wk)) { add(otb, nk, 'w_n', 1); add(otb, nk, 'w_rev', gross); }
    }
  });

  const dump = (name, header, rows) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, rows.length + 1, 2).setNumberFormat('@');
    sh.appendRow(header);
    if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  };
  const sp = k => k.split('|');

  dump('agg_channels', ['канал','месяц','ночей','выручка_gross','комиссия','выручка_net','ADR_gross','комиссия_%','отмен_ночей','сумма_отмен'],
    Object.keys(ch).sort().map(k => { const v = ch[k]; const n = v.n || 0, g = v.gross || 0;
      return [sp(k)[0], sp(k)[1], n, R(g), R(v.comm || 0), R(v.net || 0),
              n ? R(g / n) : 0, g ? Math.round((v.comm || 0) / g * 1000) / 10 : 0,
              v.cn || 0, R(v.csum || 0)]; }));

  dump('agg_category', ['категория','месяц','ночей','выручка_gross','ADR','отмен_ночей'],
    Object.keys(cat).sort().map(k => { const v = cat[k]; const n = v.n || 0;
      return [sp(k)[0], sp(k)[1], n, R(v.gross || 0), n ? R((v.gross || 0) / n) : 0, v.cn || 0]; }));

  dump('agg_daily', ['дата','ночей','выручка_gross','ADR','выручка_net'],
    Object.keys(daily).sort().map(k => [k, daily[k].n, R(daily[k].gross),
      R(daily[k].gross / daily[k].n), R(daily[k].net)]));

  dump('agg_pickup', ['месяц заезда','срок до заезда','ночей'],
    Object.keys(pick).sort().map(k => [sp(k)[0], sp(k)[1], pick[k].n]));

  dump('agg_otb', ['дата','ночей сейчас','выручка сейчас','ночей нед. назад','прирост ночей','прирост выручки'],
    Object.keys(otb).sort().map(k => [k, otb[k].now_n || 0, R(otb[k].now_rev || 0),
      otb[k].w_n || 0, (otb[k].now_n || 0) - (otb[k].w_n || 0), R((otb[k].now_rev || 0) - (otb[k].w_rev || 0))]));

  dump('agg_cancels', ['дата отмены','ночей','сумма_gross','по каналам'],
    Object.keys(canc).sort().map(k => [k, canc[k].n, R(canc[k].sum),
      Object.keys(canc[k].by).sort((a, b) => canc[k].by[b] - canc[k].by[a])
        .slice(0, 4).map(s => s + ': ' + canc[k].by[s]).join('; ')]));

  Logger.log('Сводки готовы');
}

// Копирует сводки в отдельный файл B125_agg (его читает Claude)
function exportAgg() {
  const src = SpreadsheetApp.openById(CFG.SHEET_ID);
  let dst;
  try { dst = SpreadsheetApp.openById(CFG.AGG_ID); } catch (e) { dst = SpreadsheetApp.create('B125_agg'); }
  dst.insertSheet('tmp_' + Date.now());
  ['agg_otb','agg_pickup','agg_channels','agg_category','agg_daily','agg_cancels'].forEach(function(n) {
    const old = dst.getSheetByName(n);
    if (old) dst.deleteSheet(old);
    src.getSheetByName(n).copyTo(dst).setName(n);
  });
  dst.getSheets().forEach(function(s) { if (!/^agg_/.test(s.getName())) dst.deleteSheet(s); });
  Logger.log('B125_agg: ' + dst.getUrl());
}

/* ---------- ОТЧЁТ ---------- */

function buildReport_() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID), tz = CFG.TZ;
  const get = n => { const v = ss.getSheetByName(n).getDataRange().getValues(); v.shift(); return v; };
  const key = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v).trim();
  const num = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const mln = x => (x / 1e6).toFixed(2).replace('.', ',') + ' млн';
  const pct = x => Math.round(x * 100) + '%';
  const short = s => String(s).replace(/ Путешествия \(новая версия\)/g, '')
    .replace(/ \(новая версия\)/g, '').replace(/Отели в Т-Путешествиях/g, 'Т-Путеш.')
    .replace(/Модуль бронирования/g, 'Сайт').replace(/ \(ранее — Забронируй\.ру\)/g, '')
    .replace(/\.(com|ru|рф)\b/gi, '');   // иначе MAX делает из домена ссылку

  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const base = new Date(todayKey + 'T12:00:00+03:00');
  const dayKey = i => Utilities.formatDate(new Date(base.getTime() + i * 864e5), tz, 'yyyy-MM-dd');
  const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const label = d => DOW[new Date(d + 'T12:00:00+03:00').getDay()] + ' ' + d.slice(8, 10) + '.' + d.slice(5, 7);
  const shiftM = (ym, k) => { const p = ym.split('-').map(Number); let m = p[1] + k, y = p[0];
    while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); };
  const dim = ym => { const p = ym.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); };
  const MON = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

  const curM = todayKey.slice(0, 7), prevM = shiftM(curM, -1), prevM2 = shiftM(curM, -2);

  // Актуальные цены из виджета (лист raw, их собирает collectHorizon) и округление до 10 ₽
  const px = latestPrices_();
  const rnd = x => Math.round(x / 10) * 10;
  const entry = d => (px[d] && px[d].min) || null;

  // Норма набора: доля ночей, проданных не позже чем за L дней до заезда
  const B = [['0 дней',0,0],['1-3',1,3],['4-7',4,7],['8-14',8,14],['15-30',15,30],['31+',31,60]];
  const bt = {}; let bTot = 0;
  get('agg_pickup').forEach(r => {
    const m = key(r[0]).slice(0, 7);
    if (m === prevM || m === prevM2) { bt[r[1]] = (bt[r[1]] || 0) + Number(r[2]); bTot += Number(r[2]); }
  });
  const share = L => bTot ? B.reduce((s, b) => {
    const n = bt[b[0]] || 0;
    if (b[1] >= L) return s + n;
    if (L <= b[2]) return s + n * (b[2] - L + 1) / (b[2] - b[1] + 1);
    return s; }, 0) / bTot : 0.5;

  // OTB по датам
  const otb = {};
  get('agg_otb').forEach(r => otb[key(r[0])] = {n: +r[1], rev: +r[2], dn: +r[4], drev: +r[5]});
  const risk = [], hot = []; let pn = 0, prev = 0;
  for (let i = 1; i <= 30; i++) {
    const d = dayKey(i), o = otb[d] || {n: 0, rev: 0, dn: 0, drev: 0};
    pn += o.dn; prev += o.drev;
    if (i > CFG.HORIZON) continue;
    const exp = CFG.CAPACITY * CFG.TARGET_OCC * share(i);
    const ratio = exp ? o.n / exp : 1, free = CFG.CAPACITY - o.n;
    const occ = o.n / CFG.CAPACITY;
    const adr = o.n ? o.rev / o.n : 0;
    if (i >= 2 && i <= 14 && ratio < CFG.RISK) risk.push({d, i, n: o.n, exp, ratio});
    if (i >= 3 && free > 0 &&
        ((ratio > CFG.HOT && occ >= CFG.HOT_MIN_OCC) || occ >= CFG.HOT_ANY_OCC)) {
      hot.push({d, i, n: o.n, free, adr});
    }
  }
  risk.sort((a, b) => a.ratio - b.ratio);
  hot.sort((a, b) => a.d < b.d ? -1 : 1);   // по дате

  // Месяц: факт + OTB
  const mon = {n: 0, g: 0, net: 0}, pm = {n: 0, g: 0};
  get('agg_daily').forEach(r => {
    const d = key(r[0]);
    if (d.slice(0, 7) === curM) { mon.n += +r[1]; mon.g += +r[2]; mon.net += +r[4]; }
    if (d.slice(0, 7) === prevM) { pm.n += +r[1]; pm.g += +r[2]; }
  });

  // Каналы текущего месяца
  const chs = get('agg_channels').filter(r => key(r[1]).slice(0, 7) === curM);
  let totN = 0, dirN = 0, comm = 0;
  chs.forEach(r => { totN += +r[2]; comm += +r[4]; if (/^Прямое$|^Модуль бронирования$/.test(r[0])) dirN += +r[2]; });
  const top = chs.slice().sort((a, b) => b[2] - a[2]).slice(0, 4);
  const badCanc = chs.filter(r => (+r[2] + +r[8]) >= 10 && +r[8] / (+r[2] + +r[8]) > 0.4)
    .sort((a, b) => b[8] / (+b[2] + +b[8]) - a[8] / (+a[2] + +a[8]));

  // Отмены: последние 3 дня против нормы за 28 дней до них
  const cc = get('agg_cancels').map(r => ({d: key(r[0]), n: +r[1], sum: +r[2], by: String(r[3])}));
  const d3 = dayKey(-2), d30 = dayKey(-30), yst = dayKey(-1);
  let n3 = 0, s3 = 0, nb = 0; const by3 = {};
  cc.forEach(c => {
    if (c.d >= d3) { n3 += c.n; s3 += c.sum;
      c.by.split('; ').forEach(x => { const p = x.split(': '); if (p[1]) by3[p[0]] = (by3[p[0]] || 0) + Number(p[1]); }); }
    else if (c.d >= d30) nb += c.n;
  });
  const avgB = nb / 28, spike = n3 >= 6 && n3 / 3 >= 2 * avgB;
  const ycc = cc.filter(c => c.d === yst)[0];

  // Сборка текста
  const L = [];
  L.push('📊 В125 · Pickup · ' + label(todayKey));
  L.push('');
  L.push('МЕСЯЦ (' + MON[Number(curM.slice(5)) - 1] + ', факт + брони)');
  L.push(num(mon.n) + ' ночей · ' + mln(mon.g) + ' gross / ' + mln(mon.net) + ' нетто');
  L.push('Загрузка ' + pct(mon.n / (CFG.CAPACITY * dim(curM))) + ' · ADR ' + num(mon.n ? mon.g / mon.n : 0) +
         ' · прошлый месяц ' + mln(pm.g));
  L.push('Набор за 7 дней (след. 30 дней): +' + num(pn) + ' ночей · +' + mln(prev));
  L.push('');

  L.push('🔥 ПОДНЯТЬ ЦЕНУ');
  if (hot.length) hot.slice(0, 6).forEach(h => {
    const k = h.free <= 5 ? 1.15 : 1.10, p = entry(h.d);
    L.push(label(h.d) + ' (за ' + h.i + ' дн): ' + h.n + '/' + CFG.CAPACITY + ', ADR ' + num(h.adr) +
      ' → ' + (h.free <= 5 ? '+15%, осталось ' + h.free : '+10%') +
      (p ? ' · вход ' + num(p) + ' → ' + num(rnd(p * k)) + ' ₽' : ''));
  });
  else L.push('нет дат с опережением набора');
  L.push('');

  L.push('⚠️ ОТСТАЁТ НАБОР');
  if (risk.length) risk.slice(0, 6).forEach(r => {
    const k = r.i <= 3 ? 0.90 : r.i <= 7 ? 0.94 : 1, p = entry(r.d);
    L.push(label(r.d) + ' (за ' + r.i + ' дн): ' + r.n + '/' + CFG.CAPACITY + ', норма ' + Math.round(r.exp) + ' → ' +
      (r.i <= 3 ? 'горящее −10% на OTA + прямые звонки' : r.i <= 7 ? 'акция −5–7%, продвижение' : 'усилить продвижение, цену держать') +
      (p ? ' · вход ' + num(p) + (k < 1 ? ' → ' + num(rnd(p * k)) : '') + ' ₽' : ''));
  });
  else L.push('все даты на 2–14 дней в норме');
  L.push('');

  L.push('❌ ОТМЕНЫ');
  L.push('За 3 дня: ' + n3 + ' ночей / ' + mln(s3) + ' (норма ' + (avgB * 3).toFixed(0) + ')' +
         (spike ? ' — ВСПЛЕСК' : ''));
  if (spike) L.push('  по каналам: ' + short(Object.keys(by3).sort((a, b) => by3[b] - by3[a])
    .slice(0, 4).map(k => k + ' ' + by3[k]).join(', ')));
  if (ycc) L.push('Вчера: ' + ycc.n + ' ночей · ' + short(ycc.by));
  if (badCanc.length) L.push('Много отмен в месяце: ' + badCanc.slice(0, 3).map(r =>
    short(r[0]) + ' ' + pct(+r[8] / (+r[2] + +r[8]))).join(', '));
  L.push('');

  L.push('💰 КАНАЛЫ (месяц)');
  L.push('Прямые + сайт: ' + pct(totN ? dirN / totN : 0) + ' ночей · комиссии ' + mln(comm));
  L.push(top.map(r => short(r[0]) + ' ' + r[2]).join(' · '));

  return L.join('\n').slice(0, 3900);
}

// Актуальные цены входа из виджета: последний снимок по каждой дате заезда (лист raw).
// Снимок старше 40 часов считается устаревшим и не используется.
// Возвращает {'2026-10-10': {min: 3730, at: <мс>}}. Даты без снимка отсутствуют.
function latestPrices_() {
  const out = {};
  try {
    const sh = getSheet('raw', ['Снято', 'Заезд', 'Категория', 'Осталось', 'Всего', 'Цена мин', 'Статус']);
    const last = sh.getLastRow();
    if (last < 2) return out;
    const from = Math.max(2, last - 2999);
    const rows = sh.getRange(from, 1, last - from + 1, 7).getValues();
    const k = v => (v instanceof Date) ? Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd') : String(v).slice(0, 10);
    const stamp = {};
    rows.forEach(r => { const d = k(r[1]), t = +new Date(r[0]); if (!(stamp[d] >= t)) stamp[d] = t; });
    rows.forEach(r => {
      const d = k(r[1]);
      if (+new Date(r[0]) !== stamp[d] || Date.now() - stamp[d] > 40 * 36e5) return;
      const o = out[d] || (out[d] = {min: null, at: stamp[d]});
      const left = Number(r[3]) || 0, p = Number(r[5]) || 0;
      if (left > 0 && p && (o.min === null || p < o.min)) o.min = p;
    });
  } catch (e) {
    Logger.log('Цены из raw: ' + e.message);
  }
  return out;
}

/* ---------- MAX ---------- */

// admin=true → в личный чат (MAX_CHAT_ID), иначе в чат маркетологов (MAX_REPORT_CHAT_ID)
// html=true → с HTML-разметкой (<b>, <pre>); если MAX её не примет, уйдёт простым текстом
function sendMaxReport_(text, admin, html) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('MAX_TOKEN');
  const chat = admin ? p.getProperty('MAX_CHAT_ID')
                     : (p.getProperty('MAX_REPORT_CHAT_ID') || p.getProperty('MAX_CHAT_ID'));
  const url = 'https://platform-api.max.ru/messages?chat_id=' + encodeURIComponent(chat);
  const post = body => UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: token},
    payload: JSON.stringify(body),
    muteHttpExceptions: true});

  let r = post(html ? {text: text, format: 'html'} : {text: text});
  if (html && r.getResponseCode() !== 200) {
    r = post({text: text.replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')});
  }

  Logger.log('MAX: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  if (r.getResponseCode() !== 200) throw new Error('MAX ответил ' + r.getResponseCode());
}

// Показать чаты, где состоит бот, — чтобы найти chat_id чата маркетологов
function listMaxChats() {
  const token = PropertiesService.getScriptProperties().getProperty('MAX_TOKEN');
  const r = UrlFetchApp.fetch('https://platform-api.max.ru/chats',
    {headers: {Authorization: token}, muteHttpExceptions: true});
  Logger.log(r.getResponseCode() + ' ' + r.getContentText().slice(0, 3000));
}

/* ---------- ПРОВЕРКА ФОНДА ---------- */

// Сколько номеров в Bnovo. Результат в журнале (Вид → Журналы).
// 1) уникальные номера из броней за 12 месяцев (нижняя граница: непроданный номер не виден);
// 2) пробный запрос списка номеров /rooms — смотрим ответ в журнале.
function countRooms() {
  const t = bnovoToken(), H = {headers: {Authorization: 'Bearer ' + t}, muteHttpExceptions: true};
  const all = {}, byMonth = {};
  monthStarts_(12).forEach(function(m) {
    const p = m.split('-').map(Number);
    const end = m.slice(0, 8) + String(new Date(p[0], p[1], 0).getDate()).padStart(2, '0');
    let offset = 0, portion;
    do {
      const r = UrlFetchApp.fetch('https://api.pms.bnovo.ru/api/v1/bookings?date_from=' + m +
        '&date_to=' + end + '&limit=50&offset=' + offset, H);
      if (r.getResponseCode() !== 200) throw new Error('Bnovo ' + r.getResponseCode() + ' (' + m + ')');
      const body = JSON.parse(r.getContentText());
      portion = (body.data && body.data.bookings) || body.bookings || [];
      portion.forEach(function(bk) {
        (bk.prices || []).forEach(function(pr) {
          const n = pr.room_name || bk.room_name;
          if (!n || /овербук/i.test(pr.room_type_name || '')) return;
          all[n] = 1;
          (byMonth[pr.date.slice(0, 7)] = byMonth[pr.date.slice(0, 7)] || {})[n] = 1;
        });
      });
      offset += 50;
      Utilities.sleep(300);
    } while (portion.length === 50);
  });
  Object.keys(byMonth).sort().forEach(function(k) { Logger.log(k + ': ' + Object.keys(byMonth[k]).length + ' номеров'); });
  Logger.log('Уникальных номеров в бронях за 12 мес.: ' + Object.keys(all).length);

  const r = UrlFetchApp.fetch('https://api.pms.bnovo.ru/api/v1/rooms?limit=200', H);
  Logger.log('/rooms: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 1500));
}
