'use strict';
/* Админ-панель: вход через Supabase Auth, CRUD авто, загрузка фото, просмотр заявок/отзывов. */
(function () {
  const $ = id => document.getElementById(id);
  const rub = n => new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽';
  const COUNTRY = { jp: '🇯🇵 Япония', kr: '🇰🇷 Корея', cn: '🇨🇳 Китай' };
  const STATUS = { order: 'Под заказ', in_stock: 'В наличии', sold: 'Продано' };
  const dt = s => s ? new Date(s).toLocaleString('ru-RU') : '';

  const loginBox = $('adminLogin'), panel = $('adminPanel');

  if (!window.DB || !window.DB.enabled) {
    $('admConfigHint').hidden = false;
    $('admLoginBtn').disabled = true;
  }

  /* ---------- Auth ---------- */
  async function refreshAuth() {
    const user = await window.DB.currentUser().catch(() => null);
    if (user) {
      loginBox.hidden = true; panel.hidden = false;
      $('admWho').textContent = user.email;
      loadAll();
    } else {
      loginBox.hidden = false; panel.hidden = true;
    }
  }

  $('adminLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('admErr').textContent = '';
    try {
      await window.DB.signIn($('admEmail').value.trim(), $('admPass').value);
      await refreshAuth();
    } catch (err) {
      $('admErr').textContent = 'Не удалось войти: ' + (err.message || err);
    }
  });
  $('admLogout').addEventListener('click', async () => { await window.DB.signOut(); refreshAuth(); });

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.admin__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin__tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      ['cars', 'leads', 'feedback'].forEach(n => $('tab-' + n).hidden = (n !== tab.dataset.tab));
    });
  });

  /* ---------- Load data ---------- */
  let cars = [];
  async function loadAll() { await loadCars(); loadLeads(); loadFeedback(); }

  async function loadCars() {
    cars = await window.DB.getCars();
    $('carsCount').textContent = cars.length;
    $('carsBody').innerHTML = cars.map(c => `
      <tr>
        <td>${c.photos && c.photos[0] ? `<img class="admin__thumb" src="${c.photos[0]}" alt="">` : '<span class="admin__thumb admin__thumb--empty"></span>'}</td>
        <td><b>${c.brand}</b> ${c.model}${c.featured ? ' ⭐' : ''}</td>
        <td>${c.year || ''}</td>
        <td>${COUNTRY[c.country] || c.country || ''}</td>
        <td>${rub(c.price)}</td>
        <td><span class="badge badge--${c.status || 'order'}">${STATUS[c.status] || 'Под заказ'}</span></td>
        <td class="admin__row-actions">
          <button class="btn btn--ghost btn--sm" data-edit="${c.id}">✎</button>
          <button class="btn btn--ghost btn--sm" data-del="${c.id}">🗑</button>
        </td>
      </tr>`).join('');
  }

  async function loadLeads() {
    try {
      const list = await window.DB.listLeads();
      $('leadsCount').textContent = list.length;
      $('leadsBody').innerHTML = list.map(l => `
        <tr><td>${dt(l.created_at)}</td><td>${esc(l.subject)}</td><td>${esc(l.name)}</td>
        <td>${esc(l.phone)}</td><td>${esc(l.comment)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="admin__empty">Заявок пока нет</td></tr>';
    } catch (e) { $('leadsBody').innerHTML = `<tr><td colspan="5" class="admin__empty">Ошибка: ${e.message}</td></tr>`; }
  }

  async function loadFeedback() {
    try {
      const list = await window.DB.listFeedback();
      $('fbCount').textContent = list.length;
      $('fbBody').innerHTML = list.map(f => `
        <tr><td>${dt(f.created_at || f.date)}</td><td>${esc(f.text)}</td>
        <td>${esc(f.contact)}</td><td>${esc(f.page)}</td></tr>`).join('')
        || '<tr><td colspan="4" class="admin__empty">Отзывов пока нет</td></tr>';
    } catch (e) { $('fbBody').innerHTML = `<tr><td colspan="4" class="admin__empty">Ошибка: ${e.message}</td></tr>`; }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m])); }

  /* ---------- Car edit ---------- */
  const editModal = $('carEdit');
  let editPhotos = [];

  function openEdit(car) {
    car = car || {};
    $('editTitle').textContent = car.id ? 'Редактировать авто' : 'Новое авто';
    $('cId').value = car.id || '';
    $('cBrand').value = car.brand || ''; $('cModel').value = car.model || '';
    $('cYear').value = car.year || ''; $('cCountry').value = car.country || 'jp';
    $('cBody').value = car.body || ''; $('cEngine').value = car.engine ?? '';
    $('cFuel').value = car.fuel || ''; $('cDrive').value = car.drive || 'FWD';
    $('cMileage').value = car.mileage ?? ''; $('cTrans').value = car.transmission || '';
    $('cPrice').value = car.price ?? ''; $('cAuction').value = car.auction || '';
    $('cStatus').value = car.status || 'order'; $('cColor').value = car.color || '#2a3852';
    $('cFeatured').checked = !!car.featured;
    editPhotos = Array.isArray(car.photos) ? car.photos.slice() : [];
    $('editErr').textContent = '';
    renderPhotos();
    editModal.hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeEdit() { editModal.hidden = true; document.body.style.overflow = ''; }
  document.querySelectorAll('[data-edit-close]').forEach(el => el.addEventListener('click', closeEdit));

  function renderPhotos() {
    $('cPhotos').innerHTML = editPhotos.map((u, i) => `
      <div class="admin__photo"><img src="${u}" alt=""><button type="button" data-rmphoto="${i}">×</button></div>`).join('');
  }
  $('cPhotos').addEventListener('click', e => {
    const b = e.target.closest('[data-rmphoto]');
    if (b) { editPhotos.splice(+b.dataset.rmphoto, 1); renderPhotos(); }
  });

  $('cPhotoFile').addEventListener('change', async e => {
    const files = [...e.target.files];
    for (const f of files) {
      try { const url = await window.DB.uploadPhoto(f); editPhotos.push(url); renderPhotos(); }
      catch (err) { $('editErr').textContent = 'Ошибка загрузки фото: ' + err.message; }
    }
    e.target.value = '';
  });

  $('addCarBtn').addEventListener('click', () => openEdit(null));

  $('carsBody').addEventListener('click', async e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) openEdit(cars.find(c => c.id === edit.dataset.edit));
    if (del) {
      const car = cars.find(c => c.id === del.dataset.del);
      if (confirm(`Удалить ${car.brand} ${car.model}?`)) {
        try { await window.DB.deleteCar(car.id); loadCars(); }
        catch (err) { alert('Ошибка: ' + err.message); }
      }
    }
  });

  $('carForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('editErr').textContent = '';
    const id = $('cId').value || ('c' + Date.now());
    const car = {
      id,
      brand: $('cBrand').value.trim(), model: $('cModel').value.trim(),
      year: +$('cYear').value || null, country: $('cCountry').value,
      body: $('cBody').value.trim(), engine: $('cEngine').value === '' ? null : +$('cEngine').value,
      fuel: $('cFuel').value.trim(), drive: $('cDrive').value,
      mileage: $('cMileage').value === '' ? null : +$('cMileage').value,
      transmission: $('cTrans').value.trim(), price: +$('cPrice').value || 0,
      auction: $('cAuction').value.trim(), status: $('cStatus').value,
      color: $('cColor').value, featured: $('cFeatured').checked, photos: editPhotos
    };
    try { await window.DB.saveCar(car); closeEdit(); loadCars(); }
    catch (err) { $('editErr').textContent = 'Ошибка сохранения: ' + (err.message || err); }
  });

  refreshAuth();
})();
