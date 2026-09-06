'use strict';
/* Админ-панель: вход через Supabase Auth, CRUD авто, загрузка фото, просмотр заявок/отзывов. */
(function () {
  const $ = id => document.getElementById(id);
  const rub = n => new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽';
  const COUNTRY = { jp: '🇯🇵 Япония', kr: '🇰🇷 Корея', cn: '🇨🇳 Китай' };
  const STATUS = { order: 'Под заказ', in_stock: 'В наличии', sold: 'Продано' };
  const dt = s => s ? new Date(s).toLocaleString('ru-RU') : '';

  const loginBox = $('adminLogin'), panel = $('adminPanel');
  const LOCAL = !window.DB || window.DB.mode === 'local';

  if (LOCAL) {
    // Локальный режим: вход логин/пароль, данные в этом браузере.
    document.querySelector('label[for="admEmail"]').textContent = 'Логин';
    $('admEmail').type = 'text';
    $('admEmail').placeholder = 'admin';
    $('admConfigHint').hidden = false;
    $('admConfigHint').textContent = 'Локальный режим: логин admin, пароль vcar. Данные хранятся в этом браузере на вашем компьютере.';
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

  // Подсказка режима на вкладке «Авто».
  $('modeHint').textContent = LOCAL
    ? 'Данные хранятся локально (в этом браузере). Чтобы показать правки всем через GitHub — нажмите «Экспорт cars.js», замените файл в репозитории и запушьте.'
    : 'Данные в Supabase — правки видны всем сразу.';

  // Экспорт каталога в cars.js для коммита.
  $('exportBtn').addEventListener('click', () => {
    const text = window.DB.exportCarsFile();
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cars.js';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.admin__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin__tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      ['cars', 'feed', 'leads', 'feedback', 'journal', 'settings'].forEach(n => $('tab-' + n).hidden = (n !== tab.dataset.tab));
      if (tab.dataset.tab === 'settings') loadSettings();
      if (tab.dataset.tab === 'feed') loadFeed();
      if (tab.dataset.tab === 'journal') loadJournal();
    });
  });

  /* ---------- Load data ---------- */
  let cars = [];
  async function loadAll() { await loadCars(); loadLeads(); loadFeedback(); }

  async function loadCars() {
    cars = await window.DB.getCars();
    renderCars();
  }

  function renderCars() {
    const q = ($('carsSearch').value || '').trim().toLowerCase();
    let list = cars.filter(c => !q || (c.brand + ' ' + c.model + ' ' + (c.body || '')).toLowerCase().includes(q));
    switch ($('carsSort').value) {
      case 'priceDesc': list = list.slice().sort((a, b) => b.price - a.price); break;
      case 'priceAsc': list = list.slice().sort((a, b) => a.price - b.price); break;
      case 'brand': list = list.slice().sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model, 'ru')); break;
    }
    $('carsCount').textContent = list.length + (list.length !== cars.length ? ' / ' + cars.length : '');
    $('carsBody').innerHTML = list.map(c => `
      <tr>
        <td>${c.photos && c.photos[0] ? `<img class="admin__thumb" src="${c.photos[0]}" alt="">` : '<span class="admin__thumb admin__thumb--empty"></span>'}</td>
        <td><b>${esc(c.brand)}</b> ${esc(c.model)}${c.featured ? ' ⭐' : ''}</td>
        <td>${c.year || ''}</td>
        <td>${COUNTRY[c.country] || c.country || ''}</td>
        <td>${rub(c.price)}</td>
        <td><span class="badge badge--${c.status || 'order'}">${STATUS[c.status] || 'Под заказ'}</span></td>
        <td class="admin__row-actions">
          <button class="btn btn--ghost btn--sm" data-edit="${c.id}" title="Редактировать">✎</button>
          <button class="btn btn--ghost btn--sm" data-dup="${c.id}" title="Дублировать">⧉</button>
          <button class="btn btn--ghost btn--sm" data-del="${c.id}" title="Удалить">🗑</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" class="admin__empty">Ничего не найдено</td></tr>';
  }
  $('carsSearch').addEventListener('input', renderCars);
  $('carsSort').addEventListener('change', renderCars);

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
    $('cDesc').value = car.desc || '';
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
    const dup = e.target.closest('[data-dup]');
    const del = e.target.closest('[data-del]');
    if (edit) openEdit(cars.find(c => c.id === edit.dataset.edit));
    if (dup) {
      const src = cars.find(c => c.id === dup.dataset.dup);
      const copy = Object.assign({}, src, { id: 'c' + Date.now(), model: src.model + ' (копия)' });
      openEdit(copy);
    }
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
      color: $('cColor').value, featured: $('cFeatured').checked,
      desc: $('cDesc').value.trim(), photos: editPhotos
    };
    try { await window.DB.saveCar(car); closeEdit(); loadCars(); }
    catch (err) { $('editErr').textContent = 'Ошибка сохранения: ' + (err.message || err); }
  });

  /* ---------- Import ---------- */
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('Импорт заменит текущий каталог. Продолжить?')) { e.target.value = ''; return; }
      const n = await window.DB.importCars(text);
      await loadCars();
      alert('Импортировано авто: ' + n);
    } catch (err) { alert('Ошибка импорта: ' + (err.message || err)); }
    e.target.value = '';
  });

  /* ---------- Settings ---------- */
  const linesToArr = t => t.split('\n').map(s => s.trim()).filter(Boolean);
  const arrToLines = a => (a || []).join('\n');

  function loadSettings() {
    const s = window.DB.getSettings();
    $('setBrand').value = s.brand || ''; $('setPhone').value = s.phone || '';
    $('setEmail').value = s.email || ''; $('setAddress').value = s.address || '';
    $('setHeroTitle').value = s.heroTitle || ''; $('setHeroLead').value = s.heroLead || '';
    $('setYoutube').value = s.socials?.youtube || ''; $('setTelegram').value = s.socials?.telegram || ''; $('setVk').value = s.socials?.vk || '';
    $('setMgrJp').value = arrToLines(s.managers?.jp); $('setMgrKr').value = arrToLines(s.managers?.kr);
    $('setMgrCn').value = arrToLines(s.managers?.cn); $('setMgrMoto').value = arrToLines(s.managers?.moto);
    const srv = window.DB.getServerConfig();
    $('setUseServer').checked = !!srv.useServer;
    $('setServerBase').value = srv.base || '';
  }
  function collectSettings() {
    return {
      brand: $('setBrand').value.trim(), phone: $('setPhone').value.trim(),
      email: $('setEmail').value.trim(), address: $('setAddress').value.trim(),
      heroTitle: $('setHeroTitle').value.trim(), heroLead: $('setHeroLead').value.trim(),
      socials: { youtube: $('setYoutube').value.trim(), telegram: $('setTelegram').value.trim(), vk: $('setVk').value.trim() },
      managers: { jp: linesToArr($('setMgrJp').value), kr: linesToArr($('setMgrKr').value), cn: linesToArr($('setMgrCn').value), moto: linesToArr($('setMgrMoto').value) }
    };
  }
  $('saveSettingsBtn').addEventListener('click', () => {
    window.DB.saveSettings(collectSettings());
    window.DB.saveServerConfig({ useServer: $('setUseServer').checked, base: $('setServerBase').value.trim() });
    $('settingsOk').hidden = false;
    setTimeout(() => $('settingsOk').hidden = true, 2600);
  });
  $('resetSettingsBtn').addEventListener('click', () => {
    if (confirm('Сбросить настройки к значениям по умолчанию?')) { window.DB.resetSettings(); loadSettings(); }
  });
  $('exportSettingsBtn').addEventListener('click', () => {
    window.DB.saveSettings(collectSettings());
    download('settings.js', window.DB.exportSettingsFile(), 'text/javascript');
  });

  function download(name, text, type) {
    const blob = new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Feed (лента) ---------- */
  let feedItems = [];
  let feedPhotos = [];

  async function loadFeed() {
    feedItems = await window.DB.getFeed();
    $('feedCount').textContent = feedItems.length;
    $('feedBody').innerHTML = feedItems.map(x => `
      <tr>
        <td>${esc(x.date)}</td>
        <td><b>${esc(x.title)}</b>${x.published === false ? ' <span class="badge">черновик</span>' : ''}</td>
        <td>${COUNTRY[x.country] || x.country || ''}</td>
        <td>${x.price ? rub(x.price) : '—'}</td>
        <td class="admin__row-actions">
          <button class="btn btn--ghost btn--sm" data-fedit="${x.id}" title="Редактировать">✎</button>
          <button class="btn btn--ghost btn--sm" data-fdel="${x.id}" title="Удалить">🗑</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="5" class="admin__empty">Записей пока нет</td></tr>';
  }

  const feedModal = $('feedEdit');
  function openFeed(item) {
    item = item || {};
    $('feedTitle').textContent = item.id ? 'Редактировать запись' : 'Новая запись';
    $('fId').value = item.id || '';
    $('fDate').value = item.date || new Date().toISOString().slice(0, 10);
    $('fCountry').value = item.country || 'jp';
    $('fPrice').value = item.price ?? '';
    $('fTitle').value = item.title || '';
    $('fSpecs').value = item.specs || '';
    $('fBody').value = item.body || '';
    $('fPublished').checked = item.published !== false;
    feedPhotos = Array.isArray(item.photos) ? item.photos.slice() : [];
    $('feedErr').textContent = '';
    renderFeedPhotos();
    feedModal.hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeFeed() { feedModal.hidden = true; document.body.style.overflow = ''; }
  document.querySelectorAll('[data-feed-close]').forEach(el => el.addEventListener('click', closeFeed));
  function renderFeedPhotos() {
    $('fPhotos').innerHTML = feedPhotos.map((u, i) => `
      <div class="admin__photo"><img src="${u}" alt=""><button type="button" data-frm="${i}">×</button></div>`).join('');
  }
  $('fPhotos').addEventListener('click', e => {
    const b = e.target.closest('[data-frm]');
    if (b) { feedPhotos.splice(+b.dataset.frm, 1); renderFeedPhotos(); }
  });
  $('fPhotoFile').addEventListener('change', async e => {
    for (const f of [...e.target.files]) {
      try { feedPhotos.push(await window.DB.uploadPhoto(f)); renderFeedPhotos(); }
      catch (err) { $('feedErr').textContent = 'Ошибка фото: ' + err.message; }
    }
    e.target.value = '';
  });
  $('addFeedBtn').addEventListener('click', () => openFeed(null));
  $('feedBody').addEventListener('click', async e => {
    const ed = e.target.closest('[data-fedit]');
    const dl = e.target.closest('[data-fdel]');
    if (ed) openFeed(feedItems.find(x => x.id === ed.dataset.fedit));
    if (dl) {
      const it = feedItems.find(x => x.id === dl.dataset.fdel);
      if (confirm(`Удалить запись «${it.title}»?`)) {
        try { await window.DB.deleteFeedItem(it.id); loadFeed(); }
        catch (err) { alert('Ошибка: ' + err.message); }
      }
    }
  });
  $('feedForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('feedErr').textContent = '';
    const item = {
      id: $('fId').value || ('f' + Date.now()),
      date: $('fDate').value,
      country: $('fCountry').value,
      price: $('fPrice').value === '' ? null : +$('fPrice').value,
      title: $('fTitle').value.trim(),
      specs: $('fSpecs').value.trim(),
      body: $('fBody').value.trim(),
      published: $('fPublished').checked,
      photos: feedPhotos
    };
    try { await window.DB.saveFeedItem(item); closeFeed(); loadFeed(); }
    catch (err) { $('feedErr').textContent = 'Ошибка сохранения: ' + (err.message || err); }
  });
  $('exportFeedBtn').addEventListener('click', () => download('feed.js', window.DB.exportFeedFile(), 'text/javascript'));

  /* ---------- Journal (журнал + отмена) ---------- */
  function loadJournal() {
    const list = window.DB.getJournal();
    $('journalCount').textContent = list.length;
    $('journalBody').innerHTML = list.map(e => {
      let a = e.action;
      if (e.action === 'car.save') a = e.before ? 'Авто изменено' : 'Авто добавлено';
      else if (e.action === 'car.delete') a = 'Авто удалено';
      else if (e.action === 'feed.save') a = e.before ? 'Запись изменена' : 'Запись добавлена';
      else if (e.action === 'feed.delete') a = 'Запись удалена';
      else if (e.action === 'settings.save') a = 'Настройки изменены';
      else if (e.action === 'server.save') a = 'Источник данных изменён';
      return `<tr>
        <td>${dt(e.ts)}</td><td>${a}</td><td>${esc(e.label)}</td>
        <td class="admin__row-actions"><button class="btn btn--ghost btn--sm" data-undo="${e.id}">↶ Отменить</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" class="admin__empty">Журнал пуст</td></tr>';
  }
  $('journalBody').addEventListener('click', async e => {
    const u = e.target.closest('[data-undo]');
    if (u && confirm('Отменить это действие?')) {
      await window.DB.undoAction(u.dataset.undo);
      loadJournal(); loadCars(); loadFeed();
    }
  });
  $('clearJournalBtn').addEventListener('click', () => {
    if (confirm('Очистить историю журнала? Сами данные останутся.')) { window.DB.clearJournal(); loadJournal(); }
  });

  refreshAuth();
})();
