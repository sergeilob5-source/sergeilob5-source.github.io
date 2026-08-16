'use strict';
/*
  Слой доступа к данным. Если Supabase настроен (config.js + библиотека загружена)
  — работаем через базу. Иначе — мягкий фолбэк на статический cars.js,
  console.log для заявок и localStorage для отзывов. Сайт работает в обоих режимах.
*/
window.DB = (function () {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_ANON_KEY;
  const hasLib = typeof window.supabase !== 'undefined' && window.supabase.createClient;
  const client = (url && key && hasLib) ? window.supabase.createClient(url, key) : null;

  const FB_KEY = 'vcar_feedback';
  const localFeedback = () => JSON.parse(localStorage.getItem(FB_KEY) || '[]');

  /* ---------- Каталог ---------- */
  async function getCars() {
    if (!client) return (window.CARS || []);
    const { data, error } = await client.from('cars').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[DB] getCars:', error.message); return (window.CARS || []); }
    return (data && data.length) ? data : (window.CARS || []);
  }

  async function saveCar(car) {
    if (!client) throw new Error('Supabase не настроен');
    const { data, error } = await client.from('cars').upsert(car).select();
    if (error) throw error;
    return data[0];
  }

  async function deleteCar(id) {
    if (!client) throw new Error('Supabase не настроен');
    const { error } = await client.from('cars').delete().eq('id', id);
    if (error) throw error;
  }

  async function uploadPhoto(file) {
    if (!client) throw new Error('Supabase не настроен');
    const safe = file.name.replace(/[^\w.\-]/g, '_');
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + '-' + safe;
    const up = await client.storage.from('car-photos').upload(name, file, { cacheControl: '3600', upsert: false });
    if (up.error) throw up.error;
    return client.storage.from('car-photos').getPublicUrl(name).data.publicUrl;
  }

  /* ---------- Заявки ---------- */
  async function submitLead(lead) {
    const row = { ...lead, page: location.pathname + location.search };
    if (!client) { console.log('[Заявка]', row); return { ok: true, local: true }; }
    const { error } = await client.from('leads').insert(row);
    if (error) { console.warn('[DB] submitLead:', error.message); console.log('[Заявка]', row); return { ok: true, local: true }; }
    return { ok: true };
  }

  /* ---------- Отзывы ---------- */
  async function submitFeedback(fb) {
    const row = { ...fb, page: location.pathname + location.search, ua: navigator.userAgent };
    // Локальный бэкап всегда.
    const list = localFeedback(); list.push({ ...row, date: new Date().toISOString() });
    localStorage.setItem(FB_KEY, JSON.stringify(list));
    if (!client) return { ok: true, local: true };
    const { error } = await client.from('feedback').insert(row);
    if (error) { console.warn('[DB] submitFeedback:', error.message); return { ok: true, local: true }; }
    return { ok: true };
  }

  /* ---------- Админ: чтение заявок/отзывов ---------- */
  async function listLeads() {
    if (!client) return [];
    const { data, error } = await client.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  }
  async function listFeedback() {
    if (!client) return localFeedback();
    const { data, error } = await client.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  }

  /* ---------- Аутентификация (админка) ---------- */
  async function signIn(email, password) {
    if (!client) throw new Error('Supabase не настроен');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error; return data.user;
  }
  async function signOut() { if (client) await client.auth.signOut(); }
  async function currentUser() {
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data.user;
  }

  return {
    enabled: !!client,
    getCars, saveCar, deleteCar, uploadPhoto,
    submitLead, submitFeedback, listLeads, listFeedback,
    signIn, signOut, currentUser
  };
})();
