function emailSummary() {
  const yday = Moment.moment().subtract(1, "day");
  const bookImages = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("books")
    .getRange("C2:K")
    .getValues()
    .filter(e => (e[8] as Date) > yday)
    .map(e => e[0]);

  const scrapImages = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("scraps")
    .getRange("C2:D")
    .getValues()
    .filter(e => (e[1] as Date) > yday)
    .map(e => e[0]);

  // console.info( groupBy(scrapImages, ""))
  const html = [...bookImages, ...scrapImages]
    .map(e => `<img src='${e}' />`)
    .join("<br/>");
  const user = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(user, "today's updagted images", "hello", {
    htmlBody: html
  });
}

// tslint:disable-next-line: only-arrow-functions
const groupBy = function<TItem>(
  xs: TItem[],
  key: string
): { [key: string]: TItem[] } {
  return xs.reduce((rv, x) => {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};
