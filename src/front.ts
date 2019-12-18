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
    htmlOutput.setTitle("MyBooks");
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
    //shouled be default, contentType: "application/x-www-form-urlencoded' 
    method: "post",
    payload: body
    // tslint:disable-next-line: object-literal-sort-keys
    //muteHttpExceptions: true
  };
  Logger.log(UrlFetchApp.getRequest(gyazoUrl, params));
  const res = UrlFetchApp.fetch(gyazoUrl, params)
  Logger.log(res.getResponseCode);
  const jsn = JSON.parse(res.getContentText());
  return jsn.get_image_url;
}

function runBackEnd() {
  return "hello from backend";
}
