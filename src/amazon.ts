function _myAWS() {
  const associateTagId = ScriptProperties.getProperty("APA_TAG_ID");
  const accessKeyId = ScriptProperties.getProperty("APA_ID");
  const secretKey = ScriptProperties.getProperty("APA_SECRET");
  const isbn = "9784053033802";

  const params = {
    Keywords: isbn,
    Resources: ["ItemInfo.ExternalIds"],
    SearchIndex: "All",
    PartnerTag: associateTagId,
    PartnerType: "Associates",
    Marketplace: "www.amazon.co.jp",
    Operation: "SearchItems"
  };

  const endpoint = "";
  const strCanonicalReuqest: string = canonicalReuqest(
    "POST",
    "endopoint",
    { queries: "" },
    { headers: "" },
    ["signedHeaders", "xxx"],
    { params: "" },
    secretKey
  );
  const url = get_request_url(associateTagId, secretKey);

  getResponse(url, params);
  Logger.log(url);
}

function a_test() {
  Logger.log(Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"));
}

function canonicalReuqest(
  method: string,
  uri: string,
  queries: object,
  headers: object,
  signedHeaders: string[],
  payload: object,
  secret: string
) {
  const _payload = Object.keys(payload).sort().map(key => key + "=" + payload[key]).join("&")
  return [
    method,
    uri,
    Object.keys(queries)
      .sort()
      .map(key => key + "=" + encodeURIComponent(queries[key]))
      .join("&"),
    Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase() + ":" + headers[key].replace(/\s{2,}/g, " "))
      .join("\n") + "\n",
    signedHeaders.map(header => header.toLowerCase()).join(";") + "\n",
    Utilities.computeHmacSha256Signature(_payload, secret)
  ].join("\n");
}

// https://webservices.amazon.com/paapi5/documentation/migration-guide/whats-new-in-paapi5.html
// https://webservices.amazon.co.jp/paapi5/scratchpad/index.html#{%22Keywords%22:%229784053033802%22,%22Resources%22:[%22ItemInfo.ExternalIds%22],%22SearchIndex%22:%22All%22,%22PartnerTag%22:%22adisciplinetr-22%22,%22PartnerType%22:%22Associates%22,%22Marketplace%22:%22www.amazon.co.jp%22,%22Operation%22:%22SearchItems%22}
// v4! but it's useful: https://qiita.com/popolon31/items/41df4c9e21078c829ac0
function get_request_url(associateTagId, secretKey) {
  const endpoint = "webservices.amazon.co.jp/paapi5/searchitems";
  // 署名が必要
  const signature = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(endpoint, secretKey)
  );
  return "https://" + endpoint + "/" + encodeURIComponent(signature);
}

function getResponse(requestUrl: string, param: object): any {
  // レスポンス取得
  // 503エラーでもレスポンスを受け取れるようにmuteHttpExceptionsをtrueにする
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    contentType: "application/json",
    method: "post",
    headers: {
      "X-Amz-Date": Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"),
      "X-Amz-Target":
        "X-Amz-Target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      "Content-Encoding": "amz-1.0"
    },
    payload: JSON.stringify(param),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(requestUrl, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 200) {
    Logger.log(response);
    return JSON.parse(responseBody);
  } else {
    // エラー時はxmlのnamespaceが異なる
    Logger.log(response);
    return "error";
  }
}

/*
https://webservices.amazon.com/paapi5/documentation/quick-start/using-curl.html

curl "https://webservices.amazon.com/paapi5/searchitems" \
-H "Host: webservices.amazon.com" \
-H "Content-Type: application/json; charset=UTF-8" \
-H "X-Amz-Date: 20200117T141328Z" \
-H "X-Amz-Target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems" \
-H "Content-Encoding: amz-1.0" \
-H "User-Agent: paapi-docs-curl/1.0.0" \
-H "Authorization: AWS4-HMAC-SHA256 Credential=AKxxx/20200117/us-east-1/ProductAdvertisingAPI/aws4_request SignedHeaders=content-encoding;host;x-amz-date;x-amz-target Signature=xxxx" \
-d "{\"Marketplace\":\"www.amazon.com\",\"PartnerType\":\"Associates\",\"PartnerTag\":\"xxxx\",\"Keywords\":\"kindle\",\"SearchIndex\":\"All\",\"ItemCount\":3,\"Resources\":[\"Images.Primary.Large\",\"ItemInfo.Title\",\"Offers.Listings.Price\"]}"

*/
