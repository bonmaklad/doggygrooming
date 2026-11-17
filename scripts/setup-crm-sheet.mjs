import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { getGoogleAuthClient, getSheetsClient, getCalendarConfig } from "../lib/googleCalendar.js";
import { readCalendarEvents, readContacts } from "../lib/googleCrm.js";
import { buildCrm } from "../lib/crm.js";
import { clientRecord } from "../lib/crmRecords.js";
import { STORE_HEADERS, createCrmStore, createSheetAppender, encodeRecord } from "../lib/crmStore.js";

try {
// Use only the app's business OAuth token, never a personal Drive connector.
const auth = getGoogleAuthClient();
const sheets = getSheetsClient();
const drive = google.drive({ version: "v3", auth });
const { data: account } = await google.oauth2({ version: "v2", auth }).userinfo.get();
if (account.email !== "cutandcuddle01@gmail.com" || !account.verified_email) throw new Error("The connected account must be cutandcuddle01@gmail.com.");
const { calendarId, timeZone } = getCalendarConfig();
const [events, contacts] = await Promise.all([readCalendarEvents(), readContacts()]);
const crm = buildCrm({ events, contacts, timeZone });
const tabs = Object.keys(STORE_HEADERS);
let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const envPath = new URL("../.env.google-connect", import.meta.url);
if (!spreadsheetId) {
  const response = await sheets.spreadsheets.create({ requestBody: {
    properties: { title: "Cut & Cuddle — Client records", locale: "en_GB", timeZone },
    sheets: [
      { properties: { sheetId: 0, title: "Read me", gridProperties: { rowCount: 30, columnCount: 3 } }, data: [{ startRow: 0, startColumn: 0, rowData: [
        ["Cut & Cuddle — Client records", ""],
        ["Owner", account.email],
        ["Use the admin to edit", "https://cutandcuddle.co.nz/admin/clients"],
        ["Contacts", "Customer names, emails and phones sync to Google Contacts when saved in the admin."],
        ["Calendar", "Appointments stay in Google Calendar. The import copies recognised visit records without changing bookings or sending invitations."],
        ["Sheets", "Dog profiles, notes, attendance and recorded payments are saved here. New Calendar visits appear here after their record is saved or imported."],
        ["Revision history", "Clients, Dogs and Visits are revision logs. Each save adds a row; earlier versions stay preserved. The admin selects the latest version of each record."],
        ["Payments", "Amount paid NZD is the recorded total for that appointment, not the quoted price. Blank means unknown; 0 means a recorded free visit. Do not sum every revision row."],
        ["Editing", "Use the admin forms to edit. Do not rename tabs, change headers, remove IDs or edit revision columns. Internal columns A–E are hidden and can be unhidden for support."],
        ["Conflicting edits", "If two versions conflict, the admin reports it instead of choosing a payment silently. Reconcile the preserved versions before continuing."],
        ["Access", "Private to the Cut & Cuddle Google account. Revoking the app connection does not delete these records."],
      ].map((row) => ({ values: row.map((value) => ({ userEnteredValue: { stringValue: value } })) })) }] },
      ...tabs.map((title, index) => ({ properties: { sheetId: index + 1, title, gridProperties: { rowCount: 50000, columnCount: STORE_HEADERS[title].length, frozenRowCount: 1 } }, data: [{ startRow: 0, startColumn: 0, rowData: [{ values: STORE_HEADERS[title].map((value) => ({ userEnteredValue: { stringValue: value } })) }] }] })),
    ],
  } }, { retry: false });
  spreadsheetId = response.data.spreadsheetId;
  // Persist immediately so a later failure can be resumed without another file.
  const env = await fs.readFile(envPath, "utf8");
  await fs.writeFile(envPath, `${env.trimEnd()}\nGOOGLE_SPREADSHEET_ID=${JSON.stringify(spreadsheetId)}\n`, { mode: 0o600 });
  await fs.chmod(envPath, 0o600);
  process.env.GOOGLE_SPREADSHEET_ID = spreadsheetId;
}
const { data: file } = await drive.files.get({ fileId: spreadsheetId, fields: "id,name,owners(emailAddress),permissions(type,role,emailAddress)" });
if (!file.owners?.some((owner) => owner.emailAddress === account.email)) throw new Error("The records spreadsheet is not owned by Cut & Cuddle.");
if (file.permissions?.some((permission) => ["anyone", "domain"].includes(permission.type))) throw new Error("The records spreadsheet must remain private.");
const store = createCrmStore(sheets, spreadsheetId);
const stored = await store.readAll();
const existing = {
  Clients: new Set(stored.profiles.map((row) => row.id)), Dogs: new Set(stored.dogProfiles.map((row) => row.id)), Visits: new Set(stored.appointmentRecords.map((row) => row.id)),
};
// Preserve stable client/dog IDs when rerunning after staff have corrected details.
const current = buildCrm({ events, contacts, ...stored, timeZone });
const records = {
  Clients: current.customers.map(clientRecord),
  Dogs: current.customers.flatMap((customer) => customer.dogs.filter((dog) => dog.name).map((dog) => ({ id: dog.id, customerId: customer.id, customerName: customer.name, name: dog.name, size: dog.size, breed: dog.breed, notes: dog.notes, aliases: dog.aliases }))),
  Visits: current.customers.flatMap((customer) => customer.history.map((visit) => ({ ...visit, calendarId, name: customer.name }))),
};
const counts = {};
const append = createSheetAppender(sheets, spreadsheetId);
for (const tab of tabs) {
  const missing = records[tab].filter((row) => !existing[tab].has(row.id));
  const values = missing.map((row) => encodeRecord(tab, { ...row, revision: `import:${createHash("sha256").update(`${spreadsheetId}:${tab}:${row.id}`).digest("hex")}`, previousRevision: "", updatedAt: new Date().toISOString() }));
  // Sequential batches stay inside quota. Exact duplicate revision rows from an
  // ambiguous network response are safely deduplicated on read.
  for (let offset = 0; offset < values.length; offset += 500) {
    await append(tab, values.slice(offset, offset + 500));
  }
  counts[tab] = { imported: values.length, existing: existing[tab].size };
}
const requests = [
  { updateDimensionProperties: { range: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 220 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: 0, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 600 }, fields: "pixelSize" } },
  { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } }, fields: "userEnteredFormat" } },
  { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 }, textFormat: { bold: true } } }, fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat" } },
];
for (const [index, tab] of tabs.entries()) {
  const sheetId = index + 1;
  requests.push(
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 }, textFormat: { bold: true }, wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 5 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: STORE_HEADERS[tab].length }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: STORE_HEADERS[tab].length } } } },
  );
  const notesIndex = STORE_HEADERS[tab].indexOf("Notes");
  requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: notesIndex, endIndex: notesIndex + 1 }, properties: { pixelSize: 320 }, fields: "pixelSize" } });
}
requests.push({ updateDimensionProperties: { range: { sheetId: 1, dimension: "COLUMNS", startIndex: 8, endIndex: 10 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } });
requests.push({ updateDimensionProperties: { range: { sheetId: 2, dimension: "COLUMNS", startIndex: 10, endIndex: 11 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } });
requests.push({ repeatCell: { range: { sheetId: 3, startRowIndex: 1, startColumnIndex: 16, endColumnIndex: 17 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: '"NZ$"#,##0.00;("NZ$"#,##0.00);"NZ$"0.00' } } }, fields: "userEnteredFormat.numberFormat" } });
requests.push({ autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "ROWS", startIndex: 0, endIndex: 11 } } });
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
const reread = await store.readAll();
const verified = buildCrm({ events, contacts, ...reread, timeZone });
const paidTotal = (model) => Math.round(model.customers.reduce((total, customer) => total + customer.totalPaid, 0) * 100);
if (verified.customers.length !== current.customers.length || paidTotal(verified) !== paidTotal(current)) throw new Error("Imported CRM totals did not reconcile. Review before deploying.");
console.log(JSON.stringify({ spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, owner: account.email, private: true, counts, customersVerified: verified.customers.length, visitsVerified: verified.customers.reduce((total, customer) => total + customer.history.length, 0), recordedPaymentTotalsMatch: true, calendarCustomersBeforeImport: crm.customers.length }));

} catch (error) {
  console.error(JSON.stringify({ error: error.response?.data?.error?.message || error.message, status: error.code || error.status || 503 }));
  process.exitCode = 1;
}
