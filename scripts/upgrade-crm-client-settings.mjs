import assert from "node:assert/strict";
import { getSheetsClient } from "../lib/googleCalendar.js";
import { STORE_HEADERS, decodeRecords } from "../lib/crmStore.js";

// Run before deploying the client settings. The previous app reads A:L, so
// adding M:N is compatible with it; existing blank statuses mean active.
try {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required.");
  const { data: metadata } = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const properties = metadata.sheets.find((sheet) => sheet.properties.title === "Clients")?.properties;
  if (!properties) throw new Error("Clients tab is missing.");
  const read = async (range) => (await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "UNFORMATTED_VALUE" })).data.values || [];
  const before = await read("'Clients'!A1:L50000");
  assert.deepEqual(before[0], STORE_HEADERS.Clients.slice(0, 12), "Unexpected Clients headers; no changes made.");
  const { sheetId, gridProperties } = properties;
  const statusCells = gridProperties.columnCount >= 13 ? await read(`'Clients'!M1:${gridProperties.columnCount >= 14 ? "N" : "M"}50000`) : [];
  const alreadyUpgraded = statusCells[0]?.[0] === "Status" && statusCells[0]?.[1] === "Groom price NZD";
  if (!alreadyUpgraded && statusCells.some((row) => row.some((value) => value !== ""))) throw new Error("Columns M:N already contains data; no changes made.");
  if (!alreadyUpgraded) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
      ...(gridProperties.columnCount < 14 ? [{ appendDimension: { sheetId, dimension: "COLUMNS", length: 14 - gridProperties.columnCount } }] : []),
      { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 12 }, rows: [{ values: ["Status", "Groom price NZD"].map((value) => ({ userEnteredValue: { stringValue: value }, userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 }, textFormat: { bold: true } } })) }], fields: "userEnteredValue,userEnteredFormat" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 12, endIndex: 14 }, properties: { pixelSize: 120 }, fields: "pixelSize" } },
      { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 14 } } } },
    ] } });
  }
  assert.deepEqual(await read("'Clients'!A1:L50000"), before, "Client data changed during migration; review before deploying.");
  const clients = decodeRecords("Clients", await read("'Clients'!A1:N50000"));
  console.log(JSON.stringify({ upgraded: !alreadyUpgraded, clients: clients.length, existingDetailsPreserved: true, customPrices: clients.filter((client) => client.groomPrice !== null).length, active: clients.filter((client) => client.status === "active").length }));
} catch (error) {
  console.error(JSON.stringify({ error: error.response?.data?.error?.message || error.message }));
  process.exitCode = 1;
}
