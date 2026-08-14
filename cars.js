'use strict';
/*
  Датасет автомобилей под заказ. Характеристики — фактические (модель, год,
  двигатель, кузов). Цены — ориентировочные «под ключ в РФ», ₽ (демо, обновляйте).
  Источники моделей/аукционов: Япония (USS, TAA), Корея (Encar), Китай.
  Фото не подтягиваются с чужих сайтов (авторские права) — используется
  цветовая заглушка. Чтобы добавить реальное фото: положите файл в /img и
  укажите путь в поле photo.
*/
window.CARS = [
  // ===== Япония =====
  { id:'jp01', country:'jp', brand:'Toyota',     model:'Corolla Fielder', year:2021, body:'Универсал', engine:1.5, fuel:'Гибрид',  drive:'FWD', mileage:38000,  transmission:'CVT', color:'#5b6b7d', price:1690000, auction:'USS' },
  { id:'jp02', country:'jp', brand:'Toyota',     model:'Roomy',           year:2022, body:'Минивэн',   engine:1.0, fuel:'Бензин',  drive:'FWD', mileage:22000,  transmission:'CVT', color:'#7a8a99', price:1540000, auction:'TAA' },
  { id:'jp03', country:'jp', brand:'Honda',      model:'Vezel',           year:2021, body:'Кроссовер', engine:1.5, fuel:'Гибрид',  drive:'AWD', mileage:41000,  transmission:'CVT', color:'#2f3b49', price:2180000, auction:'USS' },
  { id:'jp04', country:'jp', brand:'Honda',      model:'Freed',           year:2020, body:'Минивэн',   engine:1.5, fuel:'Гибрид',  drive:'FWD', mileage:52000,  transmission:'CVT', color:'#8a5a3b', price:1780000, auction:'USS' },
  { id:'jp05', country:'jp', brand:'Mazda',      model:'CX-5',            year:2020, body:'Кроссовер', engine:2.2, fuel:'Дизель',  drive:'AWD', mileage:61000,  transmission:'AT',  color:'#7d1f2b', price:2490000, auction:'TAA' },
  { id:'jp06', country:'jp', brand:'Nissan',     model:'Note e-POWER',    year:2021, body:'Хэтчбек',   engine:1.2, fuel:'Гибрид',  drive:'FWD', mileage:33000,  transmission:'CVT', color:'#3b4a5a', price:1490000, auction:'USS' },
  { id:'jp07', country:'jp', brand:'Subaru',     model:'Forester',        year:2019, body:'Кроссовер', engine:2.5, fuel:'Бензин',  drive:'AWD', mileage:72000,  transmission:'CVT', color:'#243244', price:2350000, auction:'USS' },
  { id:'jp08', country:'jp', brand:'Toyota',     model:'Alphard',         year:2019, body:'Минивэн',   engine:2.5, fuel:'Гибрид',  drive:'AWD', mileage:68000,  transmission:'CVT', color:'#1c1c1c', price:4390000, auction:'USS' },
  { id:'jp09', country:'jp', brand:'Lexus',      model:'RX 300',          year:2020, body:'Кроссовер', engine:2.0, fuel:'Бензин',  drive:'AWD', mileage:55000,  transmission:'AT',  color:'#6b6f76', price:4890000, auction:'TAA' },
  { id:'jp10', country:'jp', brand:'Toyota',     model:'Prius',           year:2021, body:'Лифтбек',   engine:1.8, fuel:'Гибрид',  drive:'FWD', mileage:40000,  transmission:'CVT', color:'#c9ccd1', price:1990000, auction:'USS' },

  // ===== Корея =====
  { id:'kr01', country:'kr', brand:'Kia',        model:'K5',              year:2021, body:'Седан',     engine:2.0, fuel:'Бензин',  drive:'FWD', mileage:47000,  transmission:'AT',  color:'#2b2f36', price:2290000, auction:'Encar' },
  { id:'kr02', country:'kr', brand:'Hyundai',    model:'Sonata',          year:2020, body:'Седан',     engine:2.0, fuel:'Бензин',  drive:'FWD', mileage:59000,  transmission:'AT',  color:'#8b8f96', price:2090000, auction:'Encar' },
  { id:'kr03', country:'kr', brand:'Hyundai',    model:'Santa Fe',        year:2021, body:'Кроссовер', engine:2.2, fuel:'Дизель',  drive:'AWD', mileage:52000,  transmission:'AT',  color:'#3a4653', price:3190000, auction:'Encar' },
  { id:'kr04', country:'kr', brand:'Kia',        model:'Sorento',         year:2021, body:'Кроссовер', engine:2.2, fuel:'Дизель',  drive:'AWD', mileage:44000,  transmission:'AT',  color:'#20242a', price:3390000, auction:'Encar' },
  { id:'kr05', country:'kr', brand:'Genesis',    model:'G80',             year:2020, body:'Седан',     engine:2.5, fuel:'Бензин',  drive:'AWD', mileage:38000,  transmission:'AT',  color:'#1a1c1f', price:3990000, auction:'Encar' },
  { id:'kr06', country:'kr', brand:'Hyundai',    model:'Grandeur',        year:2021, body:'Седан',     engine:2.5, fuel:'Бензин',  drive:'FWD', mileage:41000,  transmission:'AT',  color:'#6d7176', price:2690000, auction:'Encar' },
  { id:'kr07', country:'kr', brand:'Kia',        model:'Carnival',        year:2021, body:'Минивэн',   engine:2.2, fuel:'Дизель',  drive:'FWD', mileage:49000,  transmission:'AT',  color:'#2c333b', price:3590000, auction:'Encar' },
  { id:'kr08', country:'kr', brand:'Genesis',    model:'GV70',            year:2021, body:'Кроссовер', engine:2.5, fuel:'Бензин',  drive:'AWD', mileage:35000,  transmission:'AT',  color:'#3d2b1f', price:4290000, auction:'Encar' },

  // ===== Китай =====
  { id:'cn01', country:'cn', brand:'BYD',        model:'Han EV',          year:2022, body:'Седан',     engine:0,   fuel:'Электро', drive:'AWD', mileage:28000,  transmission:'Redu.', color:'#1f2d4a', price:3290000, auction:'China' },
  { id:'cn02', country:'cn', brand:'BYD',        model:'Song Plus DM-i',  year:2022, body:'Кроссовер', engine:1.5, fuel:'Гибрид',  drive:'FWD', mileage:31000,  transmission:'AT',  color:'#2b3a2e', price:2790000, auction:'China' },
  { id:'cn03', country:'cn', brand:'Zeekr',      model:'001',             year:2022, body:'Лифтбек',   engine:0,   fuel:'Электро', drive:'AWD', mileage:24000,  transmission:'Redu.', color:'#4a4d52', price:4190000, auction:'China' },
  { id:'cn04', country:'cn', brand:'Li Auto',    model:'L7',              year:2023, body:'Кроссовер', engine:1.5, fuel:'Гибрид',  drive:'AWD', mileage:18000,  transmission:'AT',  color:'#20242a', price:5290000, auction:'China' },
  { id:'cn05', country:'cn', brand:'Geely',      model:'Monjaro',         year:2022, body:'Кроссовер', engine:2.0, fuel:'Бензин',  drive:'AWD', mileage:39000,  transmission:'AT',  color:'#3a4653', price:3090000, auction:'China' },
  { id:'cn06', country:'cn', brand:'Chery',      model:'Tiggo 8 Pro',     year:2022, body:'Кроссовер', engine:2.0, fuel:'Бензин',  drive:'FWD', mileage:42000,  transmission:'AT',  color:'#6d7176', price:2490000, auction:'China' },
  { id:'cn07', country:'cn', brand:'Tank',       model:'300',             year:2022, body:'Внедорожник',engine:2.0,fuel:'Бензин',  drive:'AWD', mileage:36000,  transmission:'AT',  color:'#4b5320', price:3690000, auction:'China' },
  { id:'cn08', country:'cn', brand:'Zeekr',      model:'009',             year:2023, body:'Минивэн',   engine:0,   fuel:'Электро', drive:'AWD', mileage:15000,  transmission:'Redu.', color:'#1c1c1c', price:6490000, auction:'China' }
];
