function procInSheet(isbn: string): boolean {
  return addBook(isbn);
}

function getTitle(isbn: string): string {
  const title: string = "hello title #TODO2";
  return title;
}

function doGet(e: any): GoogleAppsScript.HTML.HtmlOutput {
  Logger.log(e);
  const isbn: string | undefined = e.parameter.isbn;
  const ptype: string | undefined = e.parameter.type;
  if (ptype === undefined || isbn === undefined) {
    return HtmlService.createHtmlOutput("hello11");
  } else if (ptype === "book") {
    const msg = procInSheet(isbn)
      ? "<p>uploadしました。端末のバックボタンで戻る</p>"
      : "<p>登録済みの本です</p>";
    return HtmlService.createHtmlOutput(msg).addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1"
    );
  } else if (ptype === "scrap") {
    // for capture book image
    const template = HtmlService.createTemplateFromFile("index.html");
    template.bookTitle = "";
    template.bookTitle = getTitle(isbn);
    template.isbn = isbn;
    const htmlOutput = template.evaluate();
    return htmlOutput
      .setTitle("MyBooks")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
}
