// https://developers.google.com/apps-script/guides/triggers/events
// https://community.glideapps.com/t/time-stamp-update/1382/11
// https://webapps.stackexchange.com/questions/119684/diference-between-onedit-or-onchange-trigger

function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  const rg = e.range;
  if (rg.getSheet().getName() === "books") {
    const row = rg.getRow();
    const col = rg.getColumn();
    if (col !== 11) {
      rg.getSheet()
        .getRange(row, 11)
        .setValue(new Date());
    }
  }
}

function onChange(e) {
  Logger.log(e.changeType);
  Logger.log(e);
}


function createSpreadsheetChangeTrigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();
}
