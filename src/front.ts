function procInSheet(isbn: string): void {
  addBook(isbn);
}

function getTitle(isbn: string): string {
  const title: string = "hello title #TODO";
  return title;
}

function doGet(e: any): GoogleAppsScript.HTML.HtmlOutput {
  Logger.log(e);
  const isbn: string | undefined = e.parameter.isbn;
  const ptype: string | undefined = e.parameter.type;
  if (ptype === undefined || isbn === undefined) {
    return HtmlService.createHtmlOutput("hello");
  } else if (ptype === "book") {
    procInSheet(isbn);
    return HtmlService.createHtmlOutput();
  } else if (ptype === "scrap") {
    // for capture book image
    const template = HtmlService.createTemplateFromFile("index.html");
    template.bookTitle = "";
    template.bookTitle = getTitle(isbn);
    template.isbn = isbn;
    const htmlOutput = template.evaluate();
    htmlOutput.setTitle("MyBooks");
    return htmlOutput;
  }
}
