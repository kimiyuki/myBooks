// https://developers.google.com/apps-script/guides/triggers/events
// https://community.glideapps.com/t/time-stamp-update/1382/11
// https://webapps.stackexchange.com/questions/119684/diference-between-onedit-or-onchange-trigger

function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  const rg = e.range;
  if (rg.getSheet().getName() === "books") {
    const row = rg.getRow();
    const col = rg.getColumn();
    if (col < 11) {
      rg.getSheet()
        .getRange(row, 11)
        .setValue(new Date());
    }
  }
}

function deleteEmptyRows() {
  const deleteEmptyRowsBySheet = (sheetName: string) => {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const n = sh.getLastRow();
    // as deleting row get renumbered so from bottom to top is a better strategy..
    for (let i = n; i > 1; i--) {
      if (sh.getRange(i, 1).getValue() === "") {
        sh.deleteRow(i);
      }
    }
  };

  for (const sh of ["books", "scraps"]) {
    deleteEmptyRowsBySheet(sh);
  }
}

function onChange(e) {
  console.info(e.changeType);
  console.info(e.toString());
  console.info(SpreadsheetApp.getActiveRange().getA1Notation());
  const sh = SpreadsheetApp.getActiveSheet();
  const rowNum = SpreadsheetApp.getActiveRange().getRow();
  if (sh.getName() === "books" && sh.getRange(rowNum, 1).getValue() === "") {
    // pending
    // sh.deleteRow(rowNum);
    // console.info(`delete row ${rowNum} in 'books'`);
  }
}

function createSpreadsheetChangeTrigger() {
  ScriptApp.newTrigger("onChange")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();
}
