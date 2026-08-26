// Автопостинг новых авто в Telegram-канал и VK-сообщество.
// Запускается GitHub Action при изменении cars.js.
// Токены берутся из GitHub Secrets (env), в коде их нет.
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
const rub = n => new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽';

// --- Читаем cars.js (и рукописный, и экспортированный формат) через vm ---
function loadCars() {
  const code = fs.readFileSync('cars.js', 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.CARS || [];
}

const cars = loadCars();

// --- Состояние: какие id уже опубликованы ---
let posted = [];
const firstRun = !fs.existsSync(STATE);
if (!firstRun) posted = JSON.parse(fs.readFileSync(STATE, 'utf8'));

// Первый запуск: помечаем весь текущий каталог как «уже опубликован»,
// ничего не постим (иначе спам всеми машинами сразу).
if (firstRun) {
  fs.mkdirSync('.github', { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(cars.map(c => c.id), null, 2));
  console.log('Первый запуск: отмечено', cars.length, 'авто как опубликованные. Постинг пропущен.');
  process.exit(0);
}

const postedSet = new Set(posted);
const fresh = cars.filter(c => !postedSet.has(c.id));
if (!fresh.length) { console.log('Новых авто нет.'); process.exit(0); }
console.log('Новых авто к публикации:', fresh.length);

function caption(c) {
  const link = `${SITE_URL}/catalog.html?car=${encodeURIComponent(c.id)}`;
  const parts = [
    `🚗 ${c.brand} ${c.model}${c.year ? ', ' + c.year : ''}`,
    `${COUNTRY[c.country] || ''} · ${STATUS[c.status] || 'под заказ'}`,
    c.engine ? `Двигатель: ${(+c.engine).toFixed(1)} л · ${c.fuel || ''}` : (c.fuel || ''),
    c.mileage ? `Пробег: ${new Intl.NumberFormat('ru-RU').format(c.mileage)} км` : '',
    `Цена под ключ: ${rub(c.price)}`,
    '',
    `Подробнее: ${link}`,
    '#DivanAuto #автоизяпонии #автоизкореи #автоизкитая'
  ].filter(Boolean);
  return parts.join('\n');
}

const httpPhoto = c => (c.photos || []).find(u => /^https?:\/\//.test(u));

async function tg(car) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const photo = httpPhoto(car);
  const base = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  let url, body;
  if (photo) {
    url = `${base}/sendPhoto`;
    body = { chat_id: TELEGRAM_CHAT_ID, photo, caption: caption(car) };
  } else {
    // data:-фото Telegram по URL не примет — шлём текстом.
    url = `${base}/sendMessage`;
    body = { chat_id: TELEGRAM_CHAT_ID, text: caption(car), disable_web_page_preview: false };
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) console.error('Telegram error:', j.description);
  else console.log('TG опубликовано:', car.brand, car.model);
}

async function vk(car) {
  if (!VK_TOKEN || !VK_OWNER_ID) return;
  const params = new URLSearchParams({
    owner_id: VK_OWNER_ID, from_group: '1', message: caption(car),
    access_token: VK_TOKEN, v: '5.199'
  });
  const photo = httpPhoto(car);
  if (photo) params.set('attachments', photo); // ссылка-превью; загрузка фото в VK — отдельный шаг
  const r = await fetch('https://api.vk.com/method/wall.post', { method: 'POST', body: params });
  const j = await r.json();
  if (j.error) console.error('VK error:', j.error.error_msg);
  else console.log('VK опубликовано:', car.brand, car.model);
}

for (const car of fresh) {
  try { await tg(car); } catch (e) { console.error('TG fail', e.message); }
  try { await vk(car); } catch (e) { console.error('VK fail', e.message); }
  postedSet.add(car.id);
}

fs.writeFileSync(STATE, JSON.stringify([...postedSet], null, 2));
console.log('Готово. Всего опубликовано id:', postedSet.size);
