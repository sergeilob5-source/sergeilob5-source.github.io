'use strict';
/* Лента поступлений: рендер записей из window.DB.getFeed(), фильтр по стране. */
(async function () {
  const wrap = document.getElementById('feed');
  const emptyEl = document.getElementById('feedEmpty');
  const COUNTRY = { jp: '🇯🇵 Япония', kr: '🇰🇷 Корея', cn: '🇨🇳 Китай' };
  const rub = n => n ? new Intl.NumberFormat('ru-RU').format(n) + ' ₽' : '';
  const fmtDate = s => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  wrap.innerHTML = '<div class="loading"><span class="loading__spin"></span> Загружаем ленту…</div>';
  const ALL = (window.DB ? await window.DB.getFeed() : (window.FEED || [])).filter(x => x.published !== false);
  let country = '';

  function render() {
    const list = ALL.filter(x => !country || x.country === country);
    emptyEl.hidden = list.length > 0;
    wrap.innerHTML = list.map(x => {
      const photo = (x.photos || [])[0];
      return `
      <article class="post">
        <div class="post__side">
          <time class="post__date">${fmtDate(x.date)}</time>
          ${x.country ? `<span class="post__flag">${(COUNTRY[x.country] || '').split(' ')[0]} ${(COUNTRY[x.country] || '').split(' ')[1] || ''}</span>` : ''}
        </div>
        <div class="post__card">
          ${photo ? `<img class="post__img" src="${photo}" alt="${x.title || ''}" loading="lazy">` : ''}
          <div class="post__body">
            <h3 class="post__title">${x.title || ''}</h3>
            ${x.specs ? `<p class="post__specs">${x.specs}</p>` : ''}
            ${x.body ? `<p class="post__text">${x.body}</p>` : ''}
            <div class="post__foot">
              ${x.price ? `<span class="post__price">${rub(x.price)}</span>` : '<span></span>'}
              <button class="btn btn--accent" data-modal-open data-subject="Заявка по поступлению: ${(x.title || '').replace(/"/g, '')}">Узнать подробнее</button>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');
    // Перепривязываем кнопки-модалки (они добавлены динамически).
    wrap.querySelectorAll('[data-modal-open]').forEach(btn => {
      btn.addEventListener('click', () => window.openModal && window.openModal(btn.dataset.subject));
    });
  }

  document.getElementById('feedFilters').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#feedFilters .chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    country = chip.dataset.val;
    render();
  });

  render();
})();
