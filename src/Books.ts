function main() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  const today = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm");
  const n = 2;
  const isbn = getISBN(n, 1);
  const book: IBook | undefined = getBookInfo(isbn);
  if (book !== undefined) {
    setBookData(n, 2, book);
  }
}

const getISBN = (row: number, col: number): string => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  return sheet
    .getRange(row, col)
    .getValue()
    .toString();
};

const setBookData = (row: number, startCol: number, book: IBook) => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  Logger.log(book);
  sheet
    .getRange(row, startCol, 1, 7)
    .setValues([
      [
        book.isbn,
        book.title,
        book.thumbnail,
        book.authors.join(","),
        book.publisher,
        Moment.moment(book.publishedDate).format("YYYY-MM-DD"),
        book.url
      ]
    ]);
};

interface IBook {
  isbn: string;
  url: string;
  thumbnail: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: Date | undefined;
}

function getBookInfo(isbn: string): IBook | undefined {
  if (isbn.length !== 10 && isbn.length !== 13) {
    console.log(`${isbn}: we use ISBN with 10 or 13 chars`);
    return undefined;
  }
  const url: string = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=JP`;
  const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  Logger.log(res);
  // how to write type from json??? TODO
  if (res.totalItems === 1) {
    const vol = res["items"][0]["volumeInfo"];
    return {
      isbn: isbn,
      url: res["items"][0]["selfLink"],
      thumbnail: vol["imageLinks"]["thumbnail"],
      title: vol["title"],
      authors: vol["authors"],
      publisher: vol["publisher"],
      publishedDate: Moment.moment(vol["publishedDate"]).toDate()
    };
  }
  return undefined;
}

function addBook(isbn: string): void {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  const book = getBookInfo(isbn);
  const row = sheet.getLastRow() + 1;
  setBookData(row, 1, book);
}
