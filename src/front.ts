function procInSheet(isbn: string): void {
  addBook(isbn);
}

function doGet(e: any): GoogleAppsScript.HTML.HtmlOutput {
  Logger.log(e);
  const isbn: string | undefined = e.parameter.isbn;
  if (isbn !== undefined) {
    procInSheet(isbn);
    return HtmlService.createHtmlOutput();
  } else {
    // for capture book image
    const template = HtmlService.createTemplateFromFile("index.html");
    template.bookTitle = "";
    if (e.parameter.title) {
      template.bookTitle = e.parameter.title;
    }
    const htmlOutput = template.evaluate();
    htmlOutput.setTitle("MyBooks");
    return htmlOutput;
  }
}
