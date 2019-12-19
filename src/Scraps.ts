function uploadScrap(s: string, isbn: string, page_no: number): void {
  Logger.log(s.slice(0, 30));
  const decoded = Utilities.base64Decode(s.replace(/(.*?),/, ""));
  const blb = Utilities.newBlob(
    decoded,
    "image/png",
    `${isbn}_${page_no || "0"}.png`
  );
  const file = DriveApp.getFolderById(
    ScriptProperties.getProperty("IMG_DIR")
  ).createFile(blb);
  const scrap: IScrap = createScrap(isbn, page_no, file);
  setScrapToSheet(scrap);
  Logger.log(file);
}

interface IScrap {
  isbn: string;
  page: number;
  url: string;
  create_at: Date;
}

function createScrap(isbn: string, page: number, file: GoogleAppsScript.Drive.File): IScrap {
  return {
    isbn,
    page,
    url: `https://drive.google.com/uc?id=${file.getId()}`,
    create_at: new Date()
  } as IScrap;
}

function setScrapToSheet(scrap: IScrap) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("scraps");
  const row = sheet.getLastRow() + 1;
  sheet
    .getRange(row, 1, 1, Object.keys(scrap).length)
    .setValues([[scrap.isbn, scrap.page, scrap.url, scrap.create_at]]);
};

// Upload with Browser Session API
// https://gyazo.com/api/docs/image
// response
// {
//   "get_image_url" : "https://gyazo.com/api/upload/8980c52421e452ac3355ca3e5cfe7a0c",
//   "expires_at" : 1401178164
// }
function getGyazoImageUrl(dataUrl: string, refererUrl: string): string {
  // https://gyazo.com/api/docs/image
  const gyazoUrl = "https://upload.gyazo.com/api/upload/easy_auth";
  const body = {
    client_id: ScriptProperties.getProperty("GYAZO_CLIENT_ID"),
    image_url: dataUrl,
    referer_url: encodeURIComponent(refererUrl),
    title: "foo book title"
  };
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    // shouled be default, contentType: "application/x-www-form-urlencoded'
    method: "post",
    payload: body
    // tslint:disable-next-line: object-literal-sort-keys
    // muteHttpExceptions: true
  };
  Logger.log(UrlFetchApp.getRequest(gyazoUrl, params));
  const res = UrlFetchApp.fetch(gyazoUrl, params);
  Logger.log(res.getResponseCode);
  const jsn = JSON.parse(res.getContentText());
  return jsn.get_image_url;
}