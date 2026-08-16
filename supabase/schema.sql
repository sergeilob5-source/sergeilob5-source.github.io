-- ============================================================
--  Вихляев Авто — схема базы для Supabase
--  Прогнать один раз: Supabase → SQL Editor → вставить всё → Run.
-- ============================================================

-- ---------- Таблица автомобилей ----------
create table if not exists public.cars (
  id            text primary key,
  country       text,                       -- jp | kr | cn
  brand         text not null,
  model         text not null,
  year          int,
  body          text,
  engine        numeric,                    -- объём в литрах (0 для электро)
  fuel          text,
  drive         text,
  mileage       int,
  transmission  text,
  color         text default '#2a3852',     -- цвет-заглушка, если нет фото
  price         bigint,                      -- цена «под ключ», ₽
  auction       text,
  status        text default 'order',        -- in_stock | order | sold
  featured      boolean default false,       -- «хит/новинка»
  photos        text[] default '{}',         -- ссылки на фото
  created_at    timestamptz default now()
);

-- ---------- Заявки с сайта ----------
create table if not exists public.leads (
  id         bigint generated always as identity primary key,
  subject    text,
  name       text,
  phone      text,
  comment    text,
  page       text,
  created_at timestamptz default now()
);

-- ---------- Обратная связь ----------
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  text       text,
  contact    text,
  page       text,
  ua         text,
  created_at timestamptz default now()
);

-- ============================================================
--  Row Level Security (RLS) — кто что может
-- ============================================================
alter table public.cars     enable row level security;
alter table public.leads    enable row level security;
alter table public.feedback enable row level security;

-- Авто: читать могут все; менять — только вошедший админ.
drop policy if exists cars_read  on public.cars;
drop policy if exists cars_write on public.cars;
create policy cars_read  on public.cars for select using (true);
create policy cars_write on public.cars for all to authenticated using (true) with check (true);

-- Заявки: оставить может любой; читать — только админ.
drop policy if exists leads_insert on public.leads;
drop policy if exists leads_read   on public.leads;
create policy leads_insert on public.leads for insert with check (true);
create policy leads_read   on public.leads for select to authenticated using (true);

-- Отзывы: оставить может любой; читать — только админ.
drop policy if exists feedback_insert on public.feedback;
drop policy if exists feedback_read   on public.feedback;
create policy feedback_insert on public.feedback for insert with check (true);
create policy feedback_read   on public.feedback for select to authenticated using (true);

-- ============================================================
--  Хранилище фото
--  ВАЖНО: бакет создать вручную в разделе Storage:
--    New bucket → имя  car-photos  → Public bucket → создать.
--  Политики ниже разрешают загрузку/замену/удаление только админу
--  (публичное чтение включено самим public-бакетом).
-- ============================================================
drop policy if exists car_photos_write on storage.objects;
create policy car_photos_write on storage.objects
  for all to authenticated
  using (bucket_id = 'car-photos')
  with check (bucket_id = 'car-photos');

-- ============================================================
--  (необязательно) перенос стартовых 26 авто из cars.js:
--  проще один раз добавить их через админку /admin.html.
-- ============================================================
