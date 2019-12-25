function main() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  const today = Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm");
  const n = 2;
  const isbn = getISBNFromSheet(n, 1);
  const book: IBook | undefined = getBookInfoFromAPI(isbn);
  if (book !== undefined) {
    setBookData(n, 2, book);
  }
}

const getISBNFromSheet = (row: number, col: number): string => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  return sheet
    .getRange(row, col)
    .getValue()
    .toString();
};

const setBookData = (row: number, startCol: number, book: IBook) => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  const WEB_APP_ID = ScriptProperties.getProperty("WEB_APP_ID");
  Logger.log(book);
  sheet
    .getRange(row, startCol, 1, 11)
    .setValues([
      [
        book.isbn,
        book.title,
        book.thumbnail,
        book.authors.join(","),
        book.publisher,
        Moment.moment(book.publishedDate).format("YYYY-MM-DD"),
        book.url,
        `https://script.google.com/macros/s/${WEB_APP_ID}/dev?isbn=${decodeURIComponent(
          book.isbn
        )}&type=scrap`,
        `https://www.google.com/search?q=${encodeURIComponent(
          book.title + book.authors.join()
        )}`,
        false,
        new Date()
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

function getBookInfoFromAPI(isbn: string): IBook | undefined {
  if (isbn.length !== 10 && isbn.length !== 13) {
    console.log(`${isbn}: we use ISBN with 10 or 13 chars`);
    return undefined;
  }
  const url: string = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=JP`;
  const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  Logger.log(res);
  // how to write type from json??? TODO
  if (res.totalItems === 1) {
    return setupBookObject(isbn, res);
  } else {
    return undefined;
  }
}

function setupBookObject(isbn: string, res: any): IBook {
  const vol = res.items[0].volumeInfo;
  const book = {
    isbn,
    url: res.items[0].selfLink,
    thumbnail: vol.imageLinks["thumbnail"],
    title: vol.title,
    authors: vol.authors,
    publisher: vol.publisher,
    publishedDate: Moment.moment(vol.publishedDate).toDate()
  } as IBook;
  return book;
}

function addBook(isbn: string): boolean {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("books");
  const book = getBookInfoFromAPI(isbn);
  if (
    sheet
      .getRange("A2:A")
      .getValues()
      .map(e => e.toString())
      .indexOf(book.isbn) < 0
  ) {
    const row = sheet.getLastRow() + 1;
    setBookData(row, 1, book);
    return true;
  } else {
    Logger.log(`${book.isbn} has already registered in books sheet`);
    return false;
  }
}
