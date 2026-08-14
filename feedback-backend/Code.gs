/*
  Бэкенд обратной связи для сайта «Вихляев Авто».
  Google Apps Script, привязанный к Google-таблице.

  doPost — принимает сообщение с сайта и добавляет строку в лист «feedback».
  doGet  — отдаёт все отзывы в JSON (чтобы разработчик мог их прочитать).

  Деплой и инструкция — в README.md рядом с этим файлом.
*/

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('feedback');
  if (!sh) {
    sh = ss.insertSheet('feedback');
    sh.appendRow(['Дата', 'Сообщение', 'Контакт', 'Страница', 'User-Agent']);
  }
  return sh;
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    sheet_().appendRow([
      new Date(),
      String(d.text || '').slice(0, 4000),
      String(d.contact || '').slice(0, 300),
      String(d.page || '').slice(0, 300),
      String(d.ua || '').slice(0, 500)
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  var rows = sheet_().getDataRange().getValues();
  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
