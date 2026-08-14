'use strict';

/* ===== Mobile nav ===== */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}));

/* ===== FAQ accordion ===== */
document.querySelectorAll('.faq__q').forEach(q => {
  q.addEventListener('click', () => {
    const open = q.getAttribute('aria-expanded') === 'true';
    const body = q.nextElementSibling;
    q.setAttribute('aria-expanded', String(!open));
    body.style.maxHeight = open ? '0' : body.scrollHeight + 'px';
  });
});

/* ===== Contacts accordion (multi-open, first open by default) ===== */
document.querySelectorAll('.acc__head').forEach(head => {
  const body = head.nextElementSibling;
  if (head.getAttribute('aria-expanded') === 'true') body.style.maxHeight = body.scrollHeight + 'px';
  head.addEventListener('click', () => {
    const open = head.getAttribute('aria-expanded') === 'true';
    head.setAttribute('aria-expanded', String(!open));
    body.style.maxHeight = open ? '0' : body.scrollHeight + 'px';
  });
});

/* ===== Modal (lead form) ===== */
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const leadSubject = document.getElementById('leadSubject');
let lastFocus = null;

function openModal(subject) {
  lastFocus = document.activeElement;
  leadSubject.value = subject || 'Заявка';
  modalTitle.textContent = subject || 'Оставить заявку';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('leadName').focus();
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('leadOk').hidden = true;
  if (lastFocus) lastFocus.focus();
}
window.openModal = openModal; // used by catalog.js

/* ===== Feedback (обратная связь) =====
   Сообщения складываются в localStorage браузера под ключом 'vcar_feedback'
   (массив объектов). Разработчик читает их через консоль или инструмент браузера:
     JSON.parse(localStorage.getItem('vcar_feedback') || '[]')
   Ограничение: хранилище привязано к конкретному браузеру/устройству, поэтому
   я вижу отзывы только на том устройстве, где их оставили и где открыт сайт. */
const FB_KEY = 'vcar_feedback';
window.readFeedback = () => JSON.parse(localStorage.getItem(FB_KEY) || '[]');

const fbBtn = document.getElementById('fbBtn');
if (fbBtn) {
  const fbModal = document.getElementById('fbModal');
  const fbForm = document.getElementById('fbForm');
  const fbText = document.getElementById('fbText');
  const fbContact = document.getElementById('fbContact');
  const fbOk = document.getElementById('fbOk');

  const openFb = () => { fbModal.hidden = false; document.body.style.overflow = 'hidden'; fbText.focus(); };
  const closeFb = () => { fbModal.hidden = true; document.body.style.overflow = ''; fbOk.hidden = true; };
  fbBtn.addEventListener('click', openFb);
  document.querySelectorAll('[data-fb-close]').forEach(el => el.addEventListener('click', closeFb));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fbModal.hidden) closeFb(); });

  fbForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!fbText.value.trim()) { fbText.focus(); return; }
    const entry = {
      text: fbText.value.trim(),
      contact: fbContact.value.trim() || '',
      page: location.pathname + location.search,
      ua: navigator.userAgent,
      date: new Date().toISOString()
    };
    // Локальный бэкап (на случай если бэкенд не настроен/недоступен).
    const list = window.readFeedback();
    list.push(entry);
    localStorage.setItem(FB_KEY, JSON.stringify(list));
    // Отправка на бэкенд (Google Apps Script). text/plain — чтобы не было CORS-preflight.
    const endpoint = window.FEEDBACK_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(entry)
      }).catch(() => {}); // тихо — отзыв уже сохранён локально
    }
    fbOk.hidden = false;
    fbForm.reset();
    setTimeout(closeFb, 2200);
  });
}

document.querySelectorAll('[data-modal-open]').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.subject));
});
document.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

/* ===== Phone mask ===== */
const phone = document.getElementById('leadPhone');
phone.addEventListener('input', () => {
  let d = phone.value.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 4) out += ') ' + d.slice(4, 7);
  if (d.length >= 7) out += '-' + d.slice(7, 9);
  if (d.length >= 9) out += '-' + d.slice(9, 11);
  phone.value = out;
});

/* ===== Lead form submit ===== */
const leadForm = document.getElementById('leadForm');
leadForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('leadName');
  const agree = document.getElementById('leadAgree');
  const digits = phone.value.replace(/\D/g, '');
  if (!name.value.trim()) { name.focus(); return; }
  if (digits.length < 11) { phone.focus(); return; }
  if (!agree.checked) { agree.focus(); return; }

  // Демо: реальная отправка на бэкенд/CRM подключается здесь.
  const payload = {
    subject: leadSubject.value,
    name: name.value.trim(),
    phone: phone.value,
    comment: document.getElementById('leadComment').value.trim()
  };
  console.log('Заявка:', payload);

  document.getElementById('leadOk').hidden = false;
  leadForm.querySelectorAll('input,textarea,button').forEach(el => { if (el.type !== 'hidden') el.disabled = true; });
  setTimeout(() => {
    leadForm.reset();
    leadForm.querySelectorAll('input,textarea,button').forEach(el => el.disabled = false);
    closeModal();
  }, 2200);
});

/* ===== Customs / total cost calculator ===== */
// Примерные курсы к рублю (демо). В проде тянуть с ЦБ РФ.
const RATES = { jpy: 0.55, krw: 0.062, cny: 11.6, usd: 82, rub: 1 };

const calcForm = document.getElementById('calcForm');
const calcResult = document.getElementById('calcResult');
if (calcForm) {
const rub = n => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';

// Ставки утильсбора (физлицо, личное пользование) — демо-значения.
function utilFee(age) { return age === 'new' ? 3400 : 5200; }

// Таможенная пошлина для физлица по стоимости+объёму — упрощённая модель.
function customsDuty(priceRub, volume, age, fuel) {
  if (fuel === 'ev') return priceRub * 0.15; // электро: адвалорная ставка (демо)
  // Ставка евро/см3 зависит от возраста и объёма (демо-градация)
  const EUR = 92; // курс евро (демо)
  let perCc;
  if (age === 'new') {           // до 3 лет — % от стоимости, не ниже евро/см3
    return Math.max(priceRub * 0.48, volume * 2.5 * EUR);
  } else if (age === 'mid') {    // 3–5 лет
    perCc = volume <= 1000 ? 1.5 : volume <= 1500 ? 1.7 : volume <= 1800 ? 2.5 : volume <= 2300 ? 2.7 : volume <= 3000 ? 3.0 : 3.6;
  } else {                        // старше 5 лет
    perCc = volume <= 1000 ? 3.0 : volume <= 1500 ? 3.2 : volume <= 1800 ? 3.5 : volume <= 2300 ? 4.8 : volume <= 3000 ? 5.0 : 5.7;
  }
  return volume * perCc * EUR;
}

calcForm.addEventListener('submit', e => {
  e.preventDefault();
  const price = parseFloat(document.getElementById('price').value) || 0;
  const cur = document.getElementById('currency').value;
  const age = document.getElementById('age').value;
  const volume = parseFloat(document.getElementById('volume').value) || 0;
  const fuel = document.getElementById('fuel').value;

  const carRub = price * (RATES[cur] || 1);
  const duty = customsDuty(carRub, volume, age, fuel);
  const util = utilFee(age);
  const logistics = 180000;       // доставка + брокер + СВХ + оформление (демо)
  const fee = Math.max(90000, carRub * 0.05); // комиссия компании (демо)
  const total = carRub + duty + util + logistics + fee;

  document.getElementById('rCar').textContent = rub(carRub);
  document.getElementById('rDuty').textContent = rub(duty);
  document.getElementById('rUtil').textContent = rub(util);
  document.getElementById('rLogi').textContent = rub(logistics);
  document.getElementById('rFee').textContent = rub(fee);
  document.getElementById('rTotal').textContent = rub(total);

  calcResult.hidden = false;
  calcResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
} // end if(calcForm)
