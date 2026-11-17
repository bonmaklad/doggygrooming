import { randomUUID } from "node:crypto";

// Append revisions instead of overwriting rows: a saved payment/detail is never
// destroyed by another edit, a retry or a spreadsheet sort.
export const STORE_HEADERS = {
  Clients: ["ID", "Revision", "Previous revision", "Saved at", "Contact", "Name", "Email", "Phone", "Email aliases", "Phone aliases", "Notes", "Contact sync", "Status", "Groom price NZD"],
  Dogs: ["ID", "Revision", "Previous revision", "Saved at", "Client ID", "Client", "Name", "Size", "Breed", "Notes", "Previous names"],
  Visits: ["ID", "Revision", "Previous revision", "Saved at", "Calendar ID", "Appointment start", "Appointment end", "Client", "Email", "Phone", "Dog", "Size", "Breed", "Service", "Notes", "Attendance", "Amount paid NZD", "Payment method", "Payment date", "Payment reference"],
};
export const STORE_FIELDS = {
  Clients: ["id", "revision", "previousRevision", "updatedAt", "contactResourceName", "name", "email", "phone", "emailAliases", "phoneAliases", "notes", "contactSync", "status", "groomPrice"],
  Dogs: ["id", "revision", "previousRevision", "updatedAt", "customerId", "customerName", "name", "size", "breed", "notes", "aliases"],
  Visits: ["id", "revision", "previousRevision", "updatedAt", "calendarId", "start", "end", "name", "email", "phone", "dogName", "dogSize", "breed", "service", "notes", "attendance", "amountPaid", "paymentMethod", "paymentDate", "paymentReference"],
};
const arrayFields = new Set(["emailAliases", "phoneAliases", "aliases"]);
export const storeError = (message, status = 409) => Object.assign(new Error(message), { status });

export function decodeRecords(tab, values = []) {
  const headers = STORE_HEADERS[tab];
  if (!headers || JSON.stringify(values[0]) !== JSON.stringify(headers)) {
    throw storeError(`The ${tab} sheet headers have changed. Restore the expected headers before saving.`, 503);
  }
  const revisions = new Map();
  for (const cells of values.slice(1)) {
    if (!cells.some((cell) => cell !== "" && cell !== null)) continue;
    const row = Object.fromEntries(STORE_FIELDS[tab].map((field, index) => {
      const value = cells[index] ?? "";
      if (field === "status") {
        if (value && !["active", "inactive"].includes(value)) throw storeError("Invalid client status in Clients.", 503);
        return [field, value || "active"];
      }
      if (arrayFields.has(field)) {
        let parsed;
        try { parsed = JSON.parse(value || "[]"); } catch { throw storeError(`Invalid list in ${tab}. Please check the spreadsheet.`, 503); }
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw storeError(`Invalid list in ${tab}.`, 503);
        return [field, parsed];
      }
      if (field === "amountPaid" || field === "groomPrice") {
        if (value === "") return [field, null];
        if (!/^\d+(?:\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value))) throw storeError(field === "amountPaid" ? "Invalid payment amount in Visits." : "Invalid groom price in Clients.", 503);
        return [field, Number(value)];
      }
      return [field, String(value)];
    }));
    if (!row.id || !row.revision || !Number.isFinite(Date.parse(row.updatedAt))) throw storeError(`An incomplete record was found in ${tab}.`, 503);
    const prior = revisions.get(row.revision);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw storeError(`Conflicting duplicate revision in ${tab}.`, 503);
    revisions.set(row.revision, row);
  }
  const groups = new Map();
  for (const row of revisions.values()) groups.set(row.id, [...(groups.get(row.id) || []), row]);
  return [...groups.values()].map((rows) => {
    const parents = new Set(rows.map((row) => row.previousRevision).filter(Boolean));
    const heads = rows.filter((row) => !parents.has(row.revision));
    // A fork must not silently turn two simultaneous payment edits into one.
    if (heads.length !== 1) throw storeError(`Two edits conflict in ${tab}. The saved revisions are preserved; reconcile the record before continuing.`, 503);
    return heads[0];
  });
}

export const encodeRecord = (tab, record) => STORE_FIELDS[tab].map((field) => {
  const value = record[field];
  if (field === "status") return value || "active";
  return arrayFields.has(field) ? JSON.stringify(value || []) : value ?? "";
});

const queues = new Map();
export async function withRecordLock(key, action) {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}

export function createSheetAppender(sheets, spreadsheetId) {
  let sheetIds;
  return async (tab, values) => {
    if (!values.length) return;
    if (!sheetIds) {
      const { data } = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
      sheetIds = new Map(data.sheets.map(({ properties }) => [properties.title, properties.sheetId]));
    }
    const sheetId = sheetIds.get(tab);
    if (sheetId === undefined) throw storeError(`The ${tab} sheet is missing. Restore it before saving.`, 503);
    // values.append discovers a logical table from its range. With hidden
    // internal columns, A1 can find no table and INSERT_ROWS moves the header.
    // appendCells always writes after the last data row, without table inference.
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ appendCells: {
      sheetId,
      rows: values.map((row) => ({ values: row.map((value) => ({ userEnteredValue:
        typeof value === "number" ? { numberValue: value } : { stringValue: String(value ?? "") },
      })) })),
      fields: "userEnteredValue",
    } }] } }, { retry: false });
  };
}

export function createCrmStore(sheets, spreadsheetId) {
  if (!spreadsheetId) throw storeError("Connect the records spreadsheet before saving client details or payments.", 503);
  const append = createSheetAppender(sheets, spreadsheetId);
  const read = async (tab) => {
    const lastColumn = String.fromCharCode(64 + STORE_HEADERS[tab].length);
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A1:${lastColumn}50000`, valueRenderOption: "UNFORMATTED_VALUE" });
    if ((response.data.values || []).length >= 50000) throw storeError("The records sheet has reached its configured capacity.", 503);
    return decodeRecords(tab, response.data.values);
  };
  return {
    read,
    async readAll() {
      const [profiles, dogProfiles, appointmentRecords] = await Promise.all([read("Clients"), read("Dogs"), read("Visits")]);
      return { profiles, dogProfiles, appointmentRecords };
    },
    async save(tab, record, expectedRevision = "", requestId = randomUUID()) {
      return withRecordLock(`${spreadsheetId}:${tab}:${record.id}`, async () => {
        const rows = await read(tab);
        const existing = rows.find((row) => row.id === record.id);
        if (existing?.revision === requestId) {
          const desired = encodeRecord(tab, { ...record, revision: requestId, previousRevision: existing.previousRevision, updatedAt: existing.updatedAt });
          if (JSON.stringify(desired) !== JSON.stringify(encodeRecord(tab, existing))) throw storeError("This save ID was already used for different details. Refresh and try again.");
          return existing;
        }
        if ((existing?.revision || "") !== expectedRevision) throw storeError("This record changed elsewhere. Refresh before saving your changes.");
        const saved = { ...record, revision: requestId, previousRevision: expectedRevision, updatedAt: new Date().toISOString() };
        await append(tab, [encodeRecord(tab, saved)]);
        return saved;
      });
    },
  };
}
