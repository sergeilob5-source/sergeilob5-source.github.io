'use strict';
// Регистрация service worker — включает установку как приложение и офлайн-доступ.
if ('serviceWorker' in navigator) {
  const reg = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  if (document.readyState === 'complete') reg();
  else window.addEventListener('load', reg);
}
