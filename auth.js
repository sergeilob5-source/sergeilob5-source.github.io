'use strict';
/*
  ВНИМАНИЕ: это простой клиентский «замок от случайных заходов», НЕ настоящая защита.
  Логин и пароль лежат в этом JS-файле открытым текстом — любой, кто откроет
  исходники страницы, их увидит и сможет обойти. Для реальной защиты доступа
  нужна серверная авторизация (логин на бэкенде, а не в браузере).

  Сейчас: логин admin / пароль vcar. Флаг входа хранится на время сессии вкладки.
*/
(function () {
  const USER = 'admin';
  const PASS = 'vcar';
  const KEY = 'vcar_auth';

  const gate = document.getElementById('authGate');
  if (!gate) return;

  // Уже входил в этой сессии — не показываем замок.
  if (sessionStorage.getItem(KEY) === '1') {
    gate.hidden = true;
    document.documentElement.classList.remove('gate-open');
    return;
  }
  document.documentElement.classList.add('gate-open');

  const form = document.getElementById('gateForm');
  const err = document.getElementById('gateErr');
  const login = document.getElementById('gateLogin');
  const pass = document.getElementById('gatePass');
  login.focus();

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (login.value.trim() === USER && pass.value === PASS) {
      sessionStorage.setItem(KEY, '1');
      gate.hidden = true;
      document.documentElement.classList.remove('gate-open');
    } else {
      err.textContent = 'Неверный логин или пароль';
      pass.value = '';
      pass.focus();
    }
  });
})();
