'use strict';
/* Каталог: рендер, фильтры, сортировка, детальная карточка.
   Данные из Supabase (window.DB), фолбэк — window.CARS */
(async function () {
  const grid = document.getElementById('grid');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');

  // Индикатор загрузки, пока тянем данные.
  grid.innerHTML = '<div class="loading"><span class="loading__spin"></span> Загружаем каталог…</div>';

  const CARS = window.DB ? await window.DB.getCars() : (window.CARS || []);
  const COUNTRY = { jp: '🇯🇵 Япония', kr: '🇰🇷 Корея', cn: '🇨🇳 Китай' };
  const STATUS = { order: 'Под заказ', in_stock: 'В наличии', sold: 'Продано' };
  const rub = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
  const km = n => n ? new Intl.NumberFormat('ru-RU').format(n) + ' км' : '—';
  const engTxt = c => c.engine ? (+c.engine).toFixed(1) + ' л · ' + c.fuel : c.fuel;
  const autoDesc = c => c.desc || `${c.brand} ${c.model}${c.year ? ' ' + c.year : ''} — ${c.body || 'авто'}, ${engTxt(c)}, пробег ${km(c.mileage)}. Проверенное авто из страны, поставка под ключ на ваше имя.`;

  /* --- Избранное (localStorage) --- */
  const FAV_KEY = 'vcar_fav';
  const favSet = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  const saveFav = () => localStorage.setItem(FAV_KEY, JSON.stringify([...favSet]));
  let favOnly = false;

  /* --- Toast --- */
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const F = {
    search: document.getElementById('fSearch'),
    brand: document.getElementById('fBrand'),
    body: document.getElementById('fBody'),
    fuel: document.getElementById('fFuel'),
    priceMin: document.getElementById('fPriceMin'),
    priceMax: document.getElementById('fPriceMax'),
    yearMin: document.getElementById('fYearMin'),
    yearMax: document.getElementById('fYearMax'),
    sort: document.getElementById('sort'),
  };
  let country = '';

  /* --- Populate selects from data --- */
  const uniq = key => [...new Set(CARS.map(c => c[key]))].sort();
  uniq('brand').forEach(b => F.brand.add(new Option(b, b)));
  uniq('body').forEach(b => F.body.add(new Option(b, b)));
  uniq('fuel').forEach(b => F.fuel.add(new Option(b, b)));

  /* --- Filtering --- */
  function apply() {
    const q = F.search.value.trim().toLowerCase();
    const pMin = +F.priceMin.value || 0;
    const pMax = +F.priceMax.value || Infinity;
    const yMin = +F.yearMin.value || 0;
    const yMax = +F.yearMax.value || Infinity;

    let list = CARS.filter(c => {
      if (favOnly && !favSet.has(c.id)) return false;
      if (country && c.country !== country) return false;
      if (F.brand.value && c.brand !== F.brand.value) return false;
      if (F.body.value && c.body !== F.body.value) return false;
      if (F.fuel.value && c.fuel !== F.fuel.value) return false;
      if (c.price < pMin || c.price > pMax) return false;
      if (c.year < yMin || c.year > yMax) return false;
      if (q) {
        const hay = (c.brand + ' ' + c.model + ' ' + c.body + ' ' + c.fuel).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    switch (F.sort.value) {
      case 'priceAsc': list.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': list.sort((a, b) => b.price - a.price); break;
      case 'yearDesc': list.sort((a, b) => b.year - a.year); break;
      case 'mileageAsc': list.sort((a, b) => a.mileage - b.mileage); break;
    }
    render(list);
  }

  /* --- Render cards --- */
  function render(list) {
    countEl.textContent = list.length + ' ' + plural(list.length, ['авто', 'авто', 'авто']);
    emptyEl.hidden = list.length > 0;
    grid.innerHTML = list.map(c => `
      <article class="car" data-id="${c.id}">
        <div class="car__photo" style="--c:${c.color || '#2a3852'}">
          ${c.photos && c.photos[0]
            ? `<img class="car__img" src="${c.photos[0]}" alt="${c.brand} ${c.model}" loading="lazy">`
            : `<span class="car__silh">${c.brand}</span>`}
          <span class="car__flag">${(COUNTRY[c.country] || '').split(' ')[0]}</span>
          <span class="car__badge">${c.year || ''}</span>
          ${c.featured ? '<span class="car__hit">Хит</span>' : ''}
          ${c.status && c.status !== 'order' ? `<span class="car__status car__status--${c.status}">${STATUS[c.status]}</span>` : ''}
          <button class="car__fav${favSet.has(c.id) ? ' is-on' : ''}" data-fav="${c.id}" title="В избранное" aria-label="В избранное">${favSet.has(c.id) ? '★' : '☆'}</button>
        </div>
        <div class="car__body">
          <h3 class="car__title">${c.brand} ${c.model}</h3>
          <p class="car__desc">${autoDesc(c)}</p>
          <ul class="car__specs">
            <li>${c.body}</li><li>${engTxt(c)}</li>
            <li>${c.drive}</li><li>${km(c.mileage)}</li>
          </ul>
          <div class="car__foot">
            <span class="car__price">${rub(c.price)}</span>
            <button class="btn btn--accent car__more" data-id="${c.id}">Подробнее</button>
          </div>
        </div>
      </article>`).join('');
  }

  function plural(n, f) {
    const m = n % 100, k = n % 10;
    if (m > 10 && m < 20) return f[2];
    if (k === 1) return f[0];
    if (k >= 2 && k <= 4) return f[1];
    return f[2];
  }

  /* --- Detail modal --- */
  const carModal = document.getElementById('carModal');
  const carDetail = document.getElementById('carDetail');
  function openCar(id) {
    const c = CARS.find(x => x.id === id);
    if (!c) return;
    const photos = Array.isArray(c.photos) ? c.photos : [];
    const mainPhoto = photos[0]
      ? `<img class="detail__img" id="detailMain" src="${photos[0]}" alt="${c.brand} ${c.model}">`
      : `<span class="detail__brand">${c.brand}</span>`;
    const thumbs = photos.length > 1
      ? `<div class="detail__thumbs">${photos.map((u, i) => `<img src="${u}" data-i="${i}" class="${i === 0 ? 'is-active' : ''}" alt="">`).join('')}</div>`
      : '';
    carDetail.innerHTML = `
      <div class="detail">
        <div class="detail__gallery">
          <div class="detail__photo" style="--c:${c.color || '#2a3852'}">
            <span class="car__flag">${(COUNTRY[c.country] || '').split(' ')[0]}</span>
            ${c.status && c.status !== 'order' ? `<span class="car__status car__status--${c.status}">${STATUS[c.status]}</span>` : ''}
            ${mainPhoto}
          </div>
          ${thumbs}
        </div>
        <div class="detail__info">
          <h3 class="detail__title">${c.brand} ${c.model}${c.year ? ', ' + c.year : ''}</h3>
          <div class="detail__price">${rub(c.price)} <small>под ключ, ориентировочно</small></div>
          <p class="detail__desc">${autoDesc(c)}</p>
          <table class="detail__table">
            <tr><td>Страна</td><td>${COUNTRY[c.country] || '—'}</td></tr>
            <tr><td>Статус</td><td>${STATUS[c.status] || 'Под заказ'}</td></tr>
            <tr><td>Кузов</td><td>${c.body || '—'}</td></tr>
            <tr><td>Двигатель</td><td>${c.engine ? (+c.engine).toFixed(1) + ' л' : '—'} · ${c.fuel || ''}</td></tr>
            <tr><td>Привод</td><td>${c.drive || '—'}</td></tr>
            <tr><td>КПП</td><td>${c.transmission || '—'}</td></tr>
            <tr><td>Пробег</td><td>${km(c.mileage)}</td></tr>
            <tr><td>Аукцион</td><td>${c.auction || '—'}</td></tr>
          </table>
          <div class="detail__actions">
            <button class="btn btn--accent btn--lg" id="orderThis">Заказать это авто</button>
            <button class="btn btn--ghost btn--lg" id="shareThis">🔗 Поделиться</button>
          </div>
          <p class="detail__note">Актуальные лоты и точную цену подтвердит менеджер. Фото — по запросу с аукционного листа.</p>
        </div>
      </div>`;
    carModal.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('orderThis').addEventListener('click', () => {
      closeCar();
      if (window.openModal) window.openModal('Заказ: ' + c.brand + ' ' + c.model + (c.year ? ' ' + c.year : ''));
    });
    document.getElementById('shareThis').addEventListener('click', async () => {
      const link = location.origin + location.pathname + '?car=' + c.id;
      const title = c.brand + ' ' + c.model + (c.year ? ' ' + c.year : '');
      try {
        if (navigator.share) { await navigator.share({ title, url: link }); }
        else { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); }
      } catch (err) { /* пользователь отменил — молчим */ }
    });
    const thumbsEl = carDetail.querySelector('.detail__thumbs');
    if (thumbsEl) thumbsEl.addEventListener('click', e => {
      const t = e.target.closest('img[data-i]');
      if (!t) return;
      carDetail.querySelector('#detailMain').src = photos[+t.dataset.i];
      thumbsEl.querySelectorAll('img').forEach(x => x.classList.remove('is-active'));
      t.classList.add('is-active');
    });
  }
  function closeCar() {
    carModal.hidden = true;
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-car-close]').forEach(el => el.addEventListener('click', closeCar));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !carModal.hidden) closeCar(); });

  grid.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.stopPropagation();
      const id = fav.dataset.fav;
      if (favSet.has(id)) { favSet.delete(id); toast('Убрано из избранного'); }
      else { favSet.add(id); toast('Добавлено в избранное'); }
      saveFav();
      apply();
      return;
    }
    const btn = e.target.closest('.car__more') || e.target.closest('.car');
    if (btn) openCar(btn.dataset.id);
  });

  /* --- Favorites toggle --- */
  const favToggle = document.getElementById('favToggle');
  favToggle.addEventListener('click', () => {
    favOnly = !favOnly;
    favToggle.classList.toggle('is-active', favOnly);
    favToggle.textContent = (favOnly ? '★' : '☆') + ' Избранное';
    apply();
  });

  /* --- Country chips --- */
  document.getElementById('fCountry').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#fCountry .chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    country = chip.dataset.val;
    apply();
  });

  /* --- Wire inputs --- */
  ['search', 'brand', 'body', 'fuel', 'priceMin', 'priceMax', 'yearMin', 'yearMax', 'sort']
    .forEach(k => { F[k].addEventListener('input', apply); F[k].addEventListener('change', apply); });

  document.getElementById('resetBtn').addEventListener('click', () => {
    Object.values(F).forEach(el => { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; });
    country = '';
    document.querySelectorAll('#fCountry .chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
    apply();
  });

  /* --- Deep link: ?country=jp, ?car=id --- */
  const params = new URLSearchParams(location.search);
  if (params.get('country') && COUNTRY[params.get('country')]) {
    country = params.get('country');
    document.querySelectorAll('#fCountry .chip').forEach(c => c.classList.toggle('is-active', c.dataset.val === country));
  }

  apply();

  if (params.get('car')) {
    const target = CARS.find(c => c.id === params.get('car'));
    if (target) openCar(target.id);
  }
})();
