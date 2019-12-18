function uploadScrap(s: string, title: string, page_no: number): void {
  Logger.log(s.slice(0, 30));
  const decoded = Utilities.base64Decode(s.replace(/(.*?),/, ""));
  const blb = Utilities.newBlob(
    decoded,
    "image/png",
    `${title}_${page_no}.png`
  );
  const file = DriveApp.getFolderById(
    ScriptProperties.getProperty("IMG_DIR")
  ).createFile(blb);
  Logger.log(file);
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