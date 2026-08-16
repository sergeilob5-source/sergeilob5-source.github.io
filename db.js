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
  const LS = { cars: 'vcar_cars', leads: 'vcar_leads', feedback: 'vcar_feedback', auth: 'vcar_admin' };
  const read = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
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
      if (i >= 0) list[i] = car; else list.unshift(car);
      write(LS.cars, list); return car;
    }
    const { data, error } = await client.from('cars').upsert(car).select();
    if (error) throw error; return data[0];
  }
  async function deleteCar(id) {
    if (mode === 'local') { write(LS.cars, seedCars().filter(c => c.id !== id)); return; }
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

  /* ============ Экспорт каталога в cars.js ============ */
  function exportCarsFile() {
    const cars = (mode === 'local') ? seedCars() : (window.__lastCars || []);
    return 'window.CARS = ' + JSON.stringify(cars, null, 2) + ';\n';
  }

  return {
    mode, enabled: true,
    getCars, saveCar, deleteCar, uploadPhoto,
    submitLead, submitFeedback, listLeads, listFeedback,
    signIn, signOut, currentUser, exportCarsFile
  };
})();
