function emailSummary() {
  const yday = Moment.moment().subtract(1, "day");
  const images = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("books")
    .getRange("C2:K")
    .getValues()
    .filter(e => (e[8] as Date) > yday)
    .map(e => e[0]);

  Logger.log(images);

  const html = images.map(e => `<img src='${e}' />`).join("<br/>");
  const user = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(user, "today's updagted images", "hello", {
    htmlBody: html
  });
}
