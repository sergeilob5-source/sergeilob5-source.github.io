'use strict';
/*
  Конфигурация сайта.

  SUPABASE_URL и SUPABASE_ANON_KEY — из панели Supabase
  (Project Settings → API). anon-ключ ПУБЛИЧНЫЙ, его безопасно держать в коде:
  доступ ограничивают политики RLS в базе (см. supabase/schema.sql).

  Пока поля пустые — сайт работает в офлайн-режиме:
    • каталог берётся из cars.js
    • заявки уходят в console.log
    • отзывы пишутся в localStorage
  Как только вставите ключи и прогоните schema.sql — каталог, заявки и отзывы
  начнут работать через базу, а админка (/admin.html) сможет их редактировать.
*/
window.SUPABASE_URL = '';
window.SUPABASE_ANON_KEY = '';

// Внешний бэкенд обратной связи не используется (заявки/отзывы идут через Supabase).
window.FEEDBACK_ENDPOINT = '';
