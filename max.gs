/**
 * max.gs - отправка в MAX через коннектор https://bot.w125.ru (бот задаётся там, не здесь).
 *
 * Добавьте как отдельный файл в тот же проект Apps Script (кнопка «+» → Скрипт).
 * Свойства проекта (Настройки проекта → Свойства скрипта):
 *   CONNECTOR_KEY      - ключ коннектора (тот же, что CONNECTOR_KEY в GitHub)
 *   MAX_REPORT_TARGET  - куда слать отчёты: псевдоним из реестра коннектора или chat_id.
 *                        Если не задан - берётся MAX_REPORT_CHAT_ID, затем «аналитика».
 *   MAX_ADMIN_TARGET   - куда слать ошибки и алерты. По умолчанию «я».
 * MAX_TOKEN и MAX_CHAT_ID больше не нужны: можно удалить.
 *
 * Проверка: test_MaxConnector() - пришлёт «Проверка связи» в MAX_ADMIN_TARGET.
 */

var MAX_CONNECTOR_URL = 'https://bot.w125.ru/notify.php';

/** Куда слать: admin=true - алерты владельцу, иначе - чат отчётов. */
function maxTarget_(admin) {
  var p = PropertiesService.getScriptProperties();
  if (admin) return p.getProperty('MAX_ADMIN_TARGET') || 'я';
  return p.getProperty('MAX_REPORT_TARGET') || p.getProperty('MAX_REPORT_CHAT_ID') || 'аналитика';
}

/**
 * Отправка текста. format: 'html' | 'markdown' | 'plain'.
 * Длинный текст коннектор сам делит на части по 4000 символов, обрезать не нужно.
 * Если MAX не примет HTML, коннектор отправит простым текстом.
 */
function maxNotify_(target, text, format) {
  var key = PropertiesService.getScriptProperties().getProperty('CONNECTOR_KEY');
  if (!key) throw new Error('Нет свойства CONNECTOR_KEY в настройках проекта');

  var payload = JSON.stringify({ target: String(target), text: text, format: format || 'plain', source: 'apps-script' });
  var url = MAX_CONNECTOR_URL, cookies = {}, r;

  // Хостинг иногда показывает страницу защиты от ботов с переадресацией (meta refresh).
  // Проходим её: запоминаем cookie и идём по адресу из страницы.
  for (var i = 0; i < 4; i++) {
    var headers = { 'X-Key': key };
    var c = Object.keys(cookies).map(function (k) { return k + '=' + cookies[k]; }).join('; ');
    if (c) headers['Cookie'] = c;
    r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: headers,
      payload: payload, muteHttpExceptions: true, followRedirects: false
    });
    var set = r.getAllHeaders()['Set-Cookie'];
    [].concat(set || []).forEach(function (s) {
      var kv = String(s).split(';')[0].split('=');
      if (kv.length >= 2) cookies[kv[0].trim()] = kv.slice(1).join('=').trim();
    });
    var body = r.getContentText();
    var m = body.match(/URL=([^"']+)/i);
    if (r.getResponseCode() === 200 && body.charAt(0) !== '{' && m) {
      url = m[1].replace(/&amp;/g, '&');
      Utilities.sleep(1500);
      continue;
    }
    break;
  }

  var code = r.getResponseCode(), text2 = r.getContentText();
  Logger.log('MAX: ' + code + ' ' + text2.slice(0, 300));
  var res = null;
  try { res = JSON.parse(text2); } catch (e) {}
  if (code !== 200 || !res || !res.ok) {
    throw new Error('Коннектор MAX: ' + code + ' ' + ((res && res.error) || text2.slice(0, 200)));
  }
  return res;
}

function test_MaxConnector() {
  maxNotify_(maxTarget_(true), 'Проверка связи из Apps Script. Коннектор работает.', 'plain');
}
