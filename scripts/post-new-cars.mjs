// Автопостинг новых авто (cars.js) и записей ленты (feed.js) в Telegram и VK.
// Запускается GitHub Action при изменении этих файлов.
// Токены — из GitHub Secrets (env), в коде их нет.
import fs from 'node:fs';
import vm from 'node:vm';

const {
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  VK_TOKEN, VK_OWNER_ID,
  SITE_URL = 'https://sergeilob5-source.github.io'
} = process.env;

const STATE = '.github/posted-cars.json';
const COUNTRY = { jp: '🇯🇵 Япония', kr: '🇰🇷 Корея', cn: '🇨🇳 Китай' };
const STATUS = { order: 'под заказ', in_stock: 'в наличии', sold: 'продано' };
const nf = n => new Intl.NumberFormat('ru-RU').format(n || 0);
const rub = n => nf(n) + ' ₽';

// Читаем window.CARS / window.FEED из JS-файла через vm.
function loadVar(file, name) {
  if (!fs.existsSync(file)) return [];
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
  return sandbox.window[name] || [];
}

const cars = loadVar('cars.js', 'CARS');
const feed = loadVar('feed.js', 'FEED').filter(x => x.published !== false);

// Состояние опубликованного: { cars: [...ids], feed: [...ids] }
let state = { cars: [], feed: [] };
const firstRun = !fs.existsSync(STATE);
if (!firstRun) {
  const raw = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  state = Array.isArray(raw) ? { cars: raw, feed: [] } : { cars: raw.cars || [], feed: raw.feed || [] };
}

// Первый запуск: помечаем всё как опубликованное, ничего не постим.
if (firstRun) {
  fs.mkdirSync('.github', { recursive: true });
  state = { cars: cars.map(c => c.id), feed: feed.map(f => f.id) };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log('Первый запуск: отмечено', state.cars.length, 'авто и', state.feed.length, 'записей. Постинг пропущен.');
  process.exit(0);
}

const carSet = new Set(state.cars);
const feedSet = new Set(state.feed);
const freshCars = cars.filter(c => !carSet.has(c.id));
const freshFeed = feed.filter(f => !feedSet.has(f.id));
console.log('Новых авто:', freshCars.length, '| новых записей ленты:', freshFeed.length);
if (!freshCars.length && !freshFeed.length) { console.log('Постить нечего.'); process.exit(0); }

const TAGS = '#DivanAuto #автоизЯпонии #автоизКореи #автоизКитая';

function carCaption(c) {
  const link = `${SITE_URL}/catalog.html?car=${encodeURIComponent(c.id)}`;
  return [
    `🚗 ${c.brand} ${c.model}${c.year ? ', ' + c.year : ''}`,
    `${COUNTRY[c.country] || ''} · ${STATUS[c.status] || 'под заказ'}`,
    c.engine ? `Двигатель: ${(+c.engine).toFixed(1)} л · ${c.fuel || ''}` : (c.fuel || ''),
    c.mileage ? `Пробег: ${nf(c.mileage)} км` : '',
    c.desc ? c.desc : '',
    `Цена под ключ: ${rub(c.price)}`, '',
    `Подробнее: ${link}`, TAGS
  ].filter(Boolean).join('\n');
}
function feedCaption(f) {
  const link = `${SITE_URL}/feed.html`;
  return [
    `🆕 Новое поступление`,
    `${f.title || ''}`,
    `${COUNTRY[f.country] || ''}`,
    f.specs ? f.specs : '',
    f.body ? f.body : '',
    f.price ? `Цена под ключ: ${rub(f.price)}` : '', '',
    `Смотреть ленту: ${link}`, TAGS
  ].filter(Boolean).join('\n');
}

const httpPhoto = x => (x.photos || []).find(u => /^https?:\/\//.test(u));

async function tg(text, photo) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const base = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  const url = photo ? `${base}/sendPhoto` : `${base}/sendMessage`;
  const body = photo
    ? { chat_id: TELEGRAM_CHAT_ID, photo, caption: text }
    : { chat_id: TELEGRAM_CHAT_ID, text };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) console.error('Telegram error:', j.description);
}
async function vk(text, photo) {
  if (!VK_TOKEN || !VK_OWNER_ID) return;
  const p = new URLSearchParams({ owner_id: VK_OWNER_ID, from_group: '1', message: text, access_token: VK_TOKEN, v: '5.199' });
  if (photo) p.set('attachments', photo);
  const r = await fetch('https://api.vk.com/method/wall.post', { method: 'POST', body: p });
  const j = await r.json();
  if (j.error) console.error('VK error:', j.error.error_msg);
}

for (const c of freshCars) {
  const cap = carCaption(c), ph = httpPhoto(c);
  try { await tg(cap, ph); } catch (e) { console.error('TG', e.message); }
  try { await vk(cap, ph); } catch (e) { console.error('VK', e.message); }
  carSet.add(c.id); console.log('Опубликовано авто:', c.brand, c.model);
}
for (const f of freshFeed) {
  const cap = feedCaption(f), ph = httpPhoto(f);
  try { await tg(cap, ph); } catch (e) { console.error('TG', e.message); }
  try { await vk(cap, ph); } catch (e) { console.error('VK', e.message); }
  feedSet.add(f.id); console.log('Опубликована запись:', f.title);
}

state = { cars: [...carSet], feed: [...feedSet] };
fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
console.log('Готово.');
