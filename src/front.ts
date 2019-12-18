function procInSheet(isbn: string): void {
  addBook(isbn);
}
function getBookTitle(){
  return 
}
function doGet(e: any): GoogleAppsScript.HTML.HtmlOutput {
  Logger.log(e);
  const isbn: string | undefined = e.parameter.isbn;
  if (isbn !== undefined) {
    procInSheet(isbn);
    return HtmlService.createHtmlOutput();
  } else {
    // for capture book image
    const htmlOutput = HtmlService.createTemplateFromFile(
      "index.html"
    ).evaluate();
    htmlOutput.setTitle("MyBooks");
    return htmlOutput;
  }
}
