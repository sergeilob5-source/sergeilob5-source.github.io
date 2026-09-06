'use strict';
/*
  Слой доступа к данным с двумя режимами:

  • local (по умолчанию) — всё хранится в localStorage ЭТОГО браузера, на твоей
    машине. Никакого облака. Каталог, заявки, отзывы, вход админа — локально.
    Правки видны только в этом браузере. Чтобы показать их всем через GitHub —
    в админке кнопка «Экспорт cars.js»: скачиваешь файл, коммитишь, готово.

  • supabase — включается сам, если в config.js заданы SUPABASE_URL и ANON_KEY.
    Пригодится позже, когда переедешь на свой сервер. Код админки/каталога
    не меняется — меняется только этот файл.

  Позже, при переезде на свой сервер, достаточно заменить реализацию функций
  ниже на запросы к вашему API — остальной сайт трогать не нужно.
*/
window.DB = (function () {
  const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
  const hasLib = typeof window.supabase !== 'undefined' && window.supabase.createClient;
  const client = (url && key && hasLib) ? window.supabase.createClient(url, key) : null;
  const mode = client ? 'supabase' : 'local';

  /* ============ Локальное хранилище ============ */
  const LS = { cars: 'vcar_cars', leads: 'vcar_leads', feedback: 'vcar_feedback', auth: 'vcar_admin', settings: 'vcar_settings', feed: 'vcar_feed', server: 'vcar_server', journal: 'vcar_journal' };
  const read = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const clone = v => (v == null ? null : JSON.parse(JSON.stringify(v)));

  /* ============ Журнал действий (для отмены и ИИ-управления) ============ */
  let suppressLog = false;
  function logAction(action, label, before, after) {
    if (suppressLog) return;
    const list = read(LS.journal, []);
    list.unshift({
      id: 'j' + Date.now() + '-' + Math.round(Math.random() * 1e4),
      ts: new Date().toISOString(), action, label,
      before: clone(before), after: clone(after)
    });
    write(LS.journal, list.slice(0, 200));
  }
  function getJournal() { return read(LS.journal, []); }
  function clearJournal() { write(LS.journal, []); }
  // Отмена действия: возвращает прежнее состояние; саму запись убирает из журнала.
  async function undoAction(entryId) {
    const list = read(LS.journal, []);
    const idx = list.findIndex(e => e.id === entryId);
    if (idx < 0) return;
    const e = list[idx];
    suppressLog = true;
    try {
      switch (e.action) {
        case 'car.save': if (e.before) await saveCar(e.before); else await deleteCar(e.after.id); break;
        case 'car.delete': if (e.before) await saveCar(e.before); break;
        case 'feed.save': if (e.before) await saveFeedItem(e.before); else await deleteFeedItem(e.after.id); break;
        case 'feed.delete': if (e.before) await saveFeedItem(e.before); break;
        case 'settings.save': if (e.before) saveSettings(e.before); break;
        case 'server.save': if (e.before) saveServerConfig(e.before); break;
      }
    } finally { suppressLog = false; }
    list.splice(idx, 1);
    write(LS.journal, list);
  }
  const LOCAL_ADMIN = { login: 'admin', pass: 'vcar' }; // локальный вход на время отладки

  // Первый заход: засеваем каталог из cars.js в localStorage.
  function seedCars() {
    let c = read(LS.cars, null);
    if (!c) {
      c = (window.CARS || []).map(x => Object.assign({ status: 'order', featured: false, photos: [] }, x));
      write(LS.cars, c);
    }
    return c;
  }
  const fileToDataURL = file => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });

  /* ============ Каталог ============ */
  async function getCars() {
    if (mode === 'local') return seedCars();
    const { data, error } = await client.from('cars').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[DB] getCars:', error.message); return (window.CARS || []); }
    return (data && data.length) ? data : (window.CARS || []);
  }
  async function saveCar(car) {
    if (mode === 'local') {
      const list = seedCars();
      const i = list.findIndex(c => c.id === car.id);
      const before = i >= 0 ? clone(list[i]) : null;
      if (i >= 0) list[i] = car; else list.unshift(car);
      write(LS.cars, list);
      logAction('car.save', (car.brand + ' ' + car.model).trim(), before, car);
      return car;
    }
    const { data, error } = await client.from('cars').upsert(car).select();
    if (error) throw error; return data[0];
  }
  async function deleteCar(id) {
    if (mode === 'local') {
      const before = seedCars().find(c => c.id === id) || null;
      write(LS.cars, seedCars().filter(c => c.id !== id));
      logAction('car.delete', before ? (before.brand + ' ' + before.model).trim() : id, before, null);
      return;
    }
    const { error } = await client.from('cars').delete().eq('id', id);
    if (error) throw error;
  }
  async function uploadPhoto(file) {
    if (mode === 'local') return await fileToDataURL(file); // фото хранится как data URL прямо в записи авто
    const safe = file.name.replace(/[^\w.\-]/g, '_');
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + '-' + safe;
    const up = await client.storage.from('car-photos').upload(name, file, { cacheControl: '3600', upsert: false });
    if (up.error) throw up.error;
    return client.storage.from('car-photos').getPublicUrl(name).data.publicUrl;
  }

  /* ============ Лента поступлений ============ */
  function seedFeed() {
    let f = read(LS.feed, null);
    if (!f) { f = (window.FEED || []).map(x => Object.assign({ published: true, photos: [] }, x)); write(LS.feed, f); }
    return f;
  }
  async function getFeed() {
    if (mode === 'local') return seedFeed().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const { data, error } = await client.from('feed').select('*').order('date', { ascending: false });
    if (error) { console.warn('[DB] getFeed:', error.message); return (window.FEED || []); }
    return data || [];
  }
  async function saveFeedItem(item) {
    if (mode === 'local') {
      const list = seedFeed();
      const i = list.findIndex(x => x.id === item.id);
      const before = i >= 0 ? clone(list[i]) : null;
      if (i >= 0) list[i] = item; else list.unshift(item);
      write(LS.feed, list);
      logAction('feed.save', item.title || item.id, before, item);
      return item;
    }
    const { data, error } = await client.from('feed').upsert(item).select();
    if (error) throw error; return data[0];
  }
  async function deleteFeedItem(id) {
    if (mode === 'local') {
      const before = seedFeed().find(x => x.id === id) || null;
      write(LS.feed, seedFeed().filter(x => x.id !== id));
      logAction('feed.delete', before ? (before.title || id) : id, before, null);
      return;
    }
    const { error } = await client.from('feed').delete().eq('id', id);
    if (error) throw error;
  }
  function exportFeedFile() {
    return 'window.FEED = ' + JSON.stringify(seedFeed(), null, 2) + ';\n';
  }

  /* ============ Заявки ============ */
  async function submitLead(lead) {
    const row = Object.assign({}, lead, { page: location.pathname + location.search, created_at: new Date().toISOString() });
    if (mode === 'local') { const l = read(LS.leads, []); l.unshift(row); write(LS.leads, l); return { ok: true, local: true }; }
    const { error } = await client.from('leads').insert(lead);
    if (error) { console.warn('[DB] submitLead:', error.message); const l = read(LS.leads, []); l.unshift(row); write(LS.leads, l); return { ok: true, local: true }; }
    return { ok: true };
  }

  /* ============ Отзывы ============ */
  async function submitFeedback(fb) {
    const row = Object.assign({}, fb, { page: location.pathname + location.search, ua: navigator.userAgent, created_at: new Date().toISOString() });
    const l = read(LS.feedback, []); l.unshift(row); write(LS.feedback, l); // локальный бэкап всегда
    if (mode === 'local') return { ok: true, local: true };
    const { error } = await client.from('feedback').insert(fb);
    if (error) { console.warn('[DB] submitFeedback:', error.message); return { ok: true, local: true }; }
    return { ok: true };
  }

  /* ============ Админ: чтение ============ */
  async function listLeads() {
    if (mode === 'local') return read(LS.leads, []);
    const { data, error } = await client.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  }
  async function listFeedback() {
    if (mode === 'local') return read(LS.feedback, []);
    const { data, error } = await client.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  }

  /* ============ Вход админа ============ */
  async function signIn(login, password) {
    if (mode === 'local') {
      if (login.trim() === LOCAL_ADMIN.login && password === LOCAL_ADMIN.pass) {
        sessionStorage.setItem(LS.auth, '1'); return { email: 'admin (локально)' };
      }
      throw new Error('неверный логин или пароль');
    }
    const { data, error } = await client.auth.signInWithPassword({ email: login, password });
    if (error) throw error; return data.user;
  }
  async function signOut() { if (mode === 'local') { sessionStorage.removeItem(LS.auth); return; } await client.auth.signOut(); }
  async function currentUser() {
    if (mode === 'local') return sessionStorage.getItem(LS.auth) === '1' ? { email: 'admin (локально)' } : null;
    const { data } = await client.auth.getUser(); return data.user;
  }

  /* ============ Экспорт/импорт каталога ============ */
  function exportCarsFile() {
    const cars = (mode === 'local') ? seedCars() : (window.__lastCars || []);
    return 'window.CARS = ' + JSON.stringify(cars, null, 2) + ';\n';
  }
  // Импорт: принимает массив авто или текст cars.js (window.CARS = [...]).
  async function importCars(input) {
    let arr = input;
    if (typeof input === 'string') {
      const m = input.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
      arr = JSON.parse(m ? m[1] : input);
    }
    if (!Array.isArray(arr)) throw new Error('Ожидался массив авто');
    const norm = arr.map(x => Object.assign({ status: 'order', featured: false, photos: [] }, x));
    if (mode === 'local') { write(LS.cars, norm); return norm.length; }
    for (const c of norm) await saveCar(c);
    return norm.length;
  }

  /* ============ Настройки сайта ============ */
  function getSettings() {
    const defaults = window.SITE_SETTINGS || {};
    const saved = read(LS.settings, null);
    // Глубокое слияние верхнего уровня + вложенных socials/managers.
    if (!saved) return JSON.parse(JSON.stringify(defaults));
    return Object.assign({}, defaults, saved, {
      socials: Object.assign({}, defaults.socials, saved.socials),
      managers: Object.assign({}, defaults.managers, saved.managers)
    });
  }
  function saveSettings(obj) {
    const before = clone(getSettings());
    write(LS.settings, obj);
    logAction('settings.save', 'Настройки сайта', before, obj);
    return obj;
  }

  /* ============ Источник данных (GitHub сейчас / свой сервер позже) ============ */
  function getServerConfig() {
    return read(LS.server, { useServer: false, base: '' });
  }
  function saveServerConfig(cfg) {
    const before = clone(getServerConfig());
    write(LS.server, cfg);
    logAction('server.save', 'Источник данных', before, cfg);
    return cfg;
  }

  function resetSettings() { localStorage.removeItem(LS.settings); }
  function exportSettingsFile() {
    return 'window.SITE_SETTINGS = ' + JSON.stringify(getSettings(), null, 2) + ';\n';
  }

  return {
    mode, enabled: true,
    getCars, saveCar, deleteCar, uploadPhoto,
    submitLead, submitFeedback, listLeads, listFeedback,
    signIn, signOut, currentUser,
    exportCarsFile, importCars,
    getFeed, saveFeedItem, deleteFeedItem, exportFeedFile,
    getSettings, saveSettings, resetSettings, exportSettingsFile,
    getServerConfig, saveServerConfig,
    getJournal, clearJournal, undoAction
  };
})();
