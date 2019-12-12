function test() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const today = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd");
  const value = "Hello clasp";
  console.log(value);
  sheet.appendRow([today, value]);
}

function receiveISBN(isbn: string): void {
  addBook(isbn);
}

function doGet(e: any): GoogleAppsScript.HTML.HtmlOutput {
  const isbn: string | undefined = e.parameter.isbn;
  if (isbn !== undefined) {
    receiveISBN(isbn);
    return HtmlService.createHtmlOutput();
  } else {
    // for capture book image
    const htmlOutput = HtmlService.createTemplateFromFile("index.html").evaluate();
    htmlOutput.setTitle("GAS+Vue.js");
    return htmlOutput;
  }
}

// Upload with Browser Session API
// https://gyazo.com/api/docs/image
// response
// {
//   "get_image_url" : "https://gyazo.com/api/upload/8980c52421e452ac3355ca3e5cfe7a0c",
//   "expires_at" : 1401178164
// }
const getGyazoImageUrl = (dataUrl: string, refererUrl: string): string => {
  // https://gyazo.com/api/docs/image
  const gyazoUrl = "https://upload.gyazo.com/api/upload/easy_auth";
  console.log(dataUrl);
  const body = JSON.stringify({
    client_id: ScriptProperties.getProperty("GYAZO_CLIENT_ID"),
    image_url: dataUrl,
    referer_url: encodeURIComponent(refererUrl),
    title: "foo book title"
  });
  const res = UrlFetchApp.fetch(gyazoUrl, {
    contentType: "application/json; charset=utf-8",
    method: "post"
  });
  const jsn = JSON.parse(res.getContentText());
  return jsn.get_image_url;
};

function runBackEnd() {
  return "hello from backend";
}
