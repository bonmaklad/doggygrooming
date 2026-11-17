import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCrmStore, decodeRecords, encodeRecord, STORE_HEADERS } from "../lib/crmStore.js";
import { contactChanges, saveClient, saveClientPricing, saveClientStatus, saveDog, visitDetails } from "../lib/crmRecords.js";
import { buildCrm, followUpRows } from "../lib/crm.js";

const memoryStore = () => {
  const cells = Object.fromEntries(Object.entries(STORE_HEADERS).map(([tab, headers]) => [tab, [[...headers]]]));
  const tabIds = { Clients: 17, Dogs: 0, Visits: 42 };
  const sheets = { spreadsheets: {
    get: async () => ({ data: { sheets: Object.entries(tabIds).map(([title, sheetId]) => ({ properties: { title, sheetId } })) } }),
    batchUpdate: async ({ requestBody }, options) => {
      assert.equal(options.retry, false);
      for (const { appendCells } of requestBody.requests) {
        assert.equal(appendCells.fields, "userEnteredValue");
        const tab = Object.keys(tabIds).find((name) => tabIds[name] === appendCells.sheetId);
        cells[tab].push(...appendCells.rows.map((row) => row.values.map(({ userEnteredValue: value }) => value.numberValue ?? value.stringValue)));
      }
    },
    values: {
      get: async ({ range }) => ({ data: { values: cells[range.split("'")[1]] } }),
    },
  } };
  return { cells, store: createCrmStore(sheets, "test") };
};
const now = new Date("2026-11-17T00:00:00Z");
const booking = { id: "event-a", etag: "v1", summary: "Full Groom", description: "Owner: Alex\nEmail: old@example.com\nDog name: Poppy\nDog size: Small", start: { dateTime: "2026-05-10T00:00:00Z" }, end: { dateTime: "2026-05-10T02:00:00Z" } };
const payload = () => ({ requestId: randomUUID(), recordRevision: "", dogName: "Poppy", attendance: "attended", amountPaid: "", paymentMethod: "", paymentDate: "", paymentReference: "" });

test("unknown and zero payments stay distinct; cents, dates and future visits are validated", () => {
  const visit = { end: booking.end.dateTime };
  assert.equal(visitDetails(payload(), visit, "Pacific/Auckland", now).amountPaid, null);
  assert.equal(visitDetails({ ...payload(), amountPaid: "0" }, visit, "Pacific/Auckland", now).amountPaid, 0);
  for (const changed of [{ amountPaid: "10.001" }, { amountPaid: "-1" }, { amountPaid: "oops" }, { paymentMethod: "Cash" }, { amountPaid: "12", paymentDate: "2026-02-30" }, { amountPaid: "12", paymentDate: "2026-12-01" }]) {
    assert.throws(() => visitDetails({ ...payload(), ...changed }, visit, "Pacific/Auckland", now), { status: 400 });
  }
  assert.throws(() => visitDetails({ ...payload(), amountPaid: "12" }, { end: "2027-01-01" }, "Pacific/Auckland", now), /after the appointment/);
});

test("sheet saves survive sort, retry and simultaneous edits without silently overwriting a payment", async () => {
  const { store, cells } = memoryStore();
  const record = { id: "a", amountPaid: 25.5 };
  const first = await store.save("Visits", record, "", "first");
  await store.save("Visits", record, "", "first");
  assert.equal(cells.Visits.length, 2);
  await assert.rejects(store.save("Visits", { ...record, amountPaid: 30 }, "", "first"), { status: 409 });
  const attempts = await Promise.allSettled([store.save("Visits", { ...record, amountPaid: 40 }, first.revision, "second"), store.save("Visits", { ...record, amountPaid: 50 }, first.revision, "third")]);
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
  cells.Visits = [cells.Visits[0], ...cells.Visits.slice(1).reverse()];
  assert.equal((await store.read("Visits"))[0].amountPaid, 40);
  cells.Visits.push(encodeRecord("Visits", { ...record, amountPaid: 60, revision: "fork", previousRevision: "first", updatedAt: now.toISOString() }));
  await assert.rejects(store.read("Visits"), /Two edits conflict/);
});

test("malformed payment data and missing headers fail closed", () => {
  assert.throws(() => decodeRecords("Visits", []), /headers/);
  assert.throws(() => decodeRecords("Visits", [STORE_HEADERS.Visits, encodeRecord("Visits", { id: "a", revision: "r", updatedAt: now.toISOString(), amountPaid: "unpaid" })]), /Invalid payment/);
});

test("client saves keep the header and all earlier rows intact, including literal text and zero prices", async () => {
  const { store, cells } = memoryStore();
  const first = await store.save("Clients", { id: "a", name: "=A1", phone: "0210000000", groomPrice: 0 }, "", "first");
  const before = structuredClone(cells.Clients);
  cells.Clients.push([]); // Blank rows must not turn the header into an append target.
  await store.save("Clients", { ...first, notes: "+Keep as text", groomPrice: 85.5 }, first.revision, "second");
  assert.deepEqual(cells.Clients.slice(0, before.length), before);
  assert.equal(cells.Clients.length, 4);
  const [saved] = await store.read("Clients");
  assert.equal(saved.name, "=A1");
  assert.equal(saved.phone, "0210000000");
  assert.equal(saved.notes, "+Keep as text");
  assert.equal(saved.groomPrice, 85.5);
  assert.equal(cells.Clients[1][13], 0);
});

test("renamed contacts and dogs retain history, use current contact details, and keep old Calendar payments", () => {
  const crm = buildCrm({ now, events: [{ ...booking, extendedProperties: { private: { ccAmountPaid: "22.50" } } }],
    contacts: [{ resourceName: "people/1", names: [{ displayName: "Alex New" }], emailAddresses: [{ value: "new@example.com" }] }],
    profiles: [{ id: "old@example.com", name: "Alex Old", contactResourceName: "people/1", contactSync: "synced", email: "new@example.com", emailAliases: ["old@example.com"], phoneAliases: [] }],
    dogProfiles: [{ id: "dog1", customerId: "old@example.com", name: "Poppy Rose", size: "Medium", breed: "Poodle", aliases: ["Poppy"], notes: "Gentle groom" }],
  });
  assert.equal(crm.customers.length, 1);
  const customer = crm.customers[0];
  assert.equal(customer.id, "old@example.com");
  assert.equal(customer.name, "Alex New");
  assert.deepEqual(customer.emails, ["new@example.com"]);
  assert.equal(customer.totalPaid, 22.5);
  assert.equal(customer.dogs.length, 1);
  assert.equal(customer.dogs[0].name, "Poppy Rose");
  assert.equal(customer.dogs[0].dueDate, "2026-07-05");
});

test("a saved visit overrides old payment data and no-show payments are still counted", () => {
  const crm = buildCrm({ now, events: [booking], appointmentRecords: [{ id: booking.id, dogName: "Poppy", attendance: "no-show", amountPaid: 25, revision: "r" }] });
  assert.equal(crm.customers[0].totalPaid, 25);
  assert.equal(crm.customers[0].pastBookings, 0);
  assert.equal(crm.customers[0].history[0].recordRevision, "r");
});

test("Contacts updates keep source etags and secondary email/phone labels", () => {
  const result = contactChanges({ etag: "e", metadata: { sources: [{ type: "CONTACT", id: "1", etag: "source-e" }] }, emailAddresses: [{ value: "secondary@example.com", type: "work" }, { value: "old@example.com", metadata: { primary: true } }], phoneNumbers: [{ value: "021111111" }, { value: "022222222", type: "work" }] }, { name: "Alex", email: "new@example.com", phone: "021333333" });
  assert.equal(result.metadata.sources[0].etag, "source-e");
  assert.deepEqual(result.emailAddresses, [{ value: "new@example.com" }, { value: "secondary@example.com", type: "work" }]);
  assert.deepEqual(result.phoneNumbers, [{ value: "021333333" }, { value: "022222222", type: "work" }]);
});

test("a failed Contacts write leaves an honest pending record and a retry avoids duplicate creation", async () => {
  const { store } = memoryStore();
  const customer = buildCrm({ events: [booking], now }).customers[0];
  const input = { ...payload(), name: "Alex", email: "new@example.com", phone: "0211234567", notes: "" };
  let created = 0;
  let updated = 0;
  let contact;
  const people = { people: {
    createContact: async ({ requestBody }) => { created++; contact = { ...requestBody, resourceName: "people/created", etag: "e", metadata: { sources: [{ type: "CONTACT", id: "created", etag: "se" }] } }; throw new Error("Response lost after successful creation"); },
    get: async () => ({ data: contact }), updateContact: async () => { updated++; },
  } };
  const args = { payload: input, customer, store, people, readContacts: async () => contact ? [contact] : [] };
  assert.equal((await saveClient(args)).contactsSynced, false);
  assert.equal((await store.read("Clients"))[0].contactSync, "pending");
  assert.equal((await saveClient(args)).contactsSynced, true);
  assert.equal((await saveClient(args)).contactsSynced, true);
  assert.equal(created, 1);
  assert.equal(updated, 1);
  assert.deepEqual((await store.read("Clients"))[0].emailAliases, ["old@example.com", "new@example.com"]);
});

test("a new dog can exist before a booking and retries do not duplicate it", async () => {
  const { store } = memoryStore();
  const customer = { id: "people/1", name: "Alex", emails: ["a@example.com"], phones: [], dogs: [], fromContacts: true, contactResourceName: "people/1" };
  const input = { ...payload(), name: "Milo", size: "Small", breed: "", notes: "" };
  await saveDog({ payload: input, customer, store });
  await saveDog({ payload: input, customer, store });
  const records = await store.readAll();
  assert.equal(records.dogProfiles.length, 1);
  const crm = buildCrm({ ...records, now });
  assert.equal(crm.customers[0].dogs[0].name, "Milo");
  assert.equal(crm.customers[0].dogs[0].dueDate, null);
  await saveDog({ payload: input, customer: crm.customers[0], store });
  assert.equal((await store.read("Dogs")).length, 1);
});

test("a historical payment stays visible when its Calendar event is removed", () => {
  const crm = buildCrm({ now, events: [], appointmentRecords: [{ id: "removed", revision: "r", name: "Alex", email: "old@example.com", phone: "", dogName: "Poppy", dogSize: "Small", start: booking.start.dateTime, end: booking.end.dateTime, attendance: "attended", amountPaid: 80 }] });
  assert.equal(crm.customers[0].totalPaid, 80);
  assert.equal(crm.customers[0].history[0].calendarMissing, true);
  assert.equal(crm.customers[0].history[0].htmlLink, "");
});

test("stale Google contact edits are rejected before any Sheet changes", async () => {
  const { store } = memoryStore();
  const customer = { id: "people/1", name: "Alex", emails: ["old@example.com"], phones: [], contactResourceName: "people/1" };
  await assert.rejects(saveClient({ payload: { ...payload(), name: "Alex New", email: "new@example.com", phone: "", contactVersion: "old" }, customer, store, people: { people: { get: async () => ({ data: { etag: "new" } }) } } }), { status: 409 });
  assert.equal((await store.read("Clients")).length, 0);
});

test("existing blank client statuses default to active and invalid status values fail closed", () => {
  const legacy = encodeRecord("Clients", { id: "a", revision: "r", updatedAt: now.toISOString() }).slice(0, 12);
  assert.equal(decodeRecords("Clients", [STORE_HEADERS.Clients, legacy])[0].status, "active");
  assert.equal(decodeRecords("Clients", [STORE_HEADERS.Clients, legacy])[0].groomPrice, null);
  assert.throws(() => decodeRecords("Clients", [STORE_HEADERS.Clients, [...legacy, "off"]]), /Invalid client status/);
});

test("turning a client off and on persists, hides all their dogs, and retains history and payments", async () => {
  const { store, cells } = memoryStore();
  const events = [
    { ...booking, extendedProperties: { private: { ccAmountPaid: "90" } } },
    { ...booking, id: "second-dog", extendedProperties: { private: { ccDogName: "Milo" } } },
    { ...booking, id: "future", start: { dateTime: "2026-12-01T00:00:00Z" }, end: { dateTime: "2026-12-01T02:00:00Z" } },
  ];
  const model = async () => buildCrm({ now, events, ...await store.readAll() });
  const initial = (await model()).customers[0];
  const off = { ...payload(), active: false };
  await saveClientStatus({ payload: off, customer: initial, store });
  await saveClientStatus({ payload: off, customer: initial, store });
  assert.equal(cells.Clients.length, 2, "retry does not duplicate a status revision");
  const inactiveCrm = await model();
  const inactive = inactiveCrm.customers[0];
  assert.equal(inactive.active, false);
  assert.equal(followUpRows(inactiveCrm.customers).length, 0);
  assert.equal(inactive.dogs.length, 2);
  assert.equal(inactive.totalPaid, 90);
  assert.equal(inactive.history.length, 3);
  assert.equal(inactive.upcoming.length, 1);
  assert.deepEqual(inactive.emails, initial.emails);
  await assert.rejects(saveClientStatus({ payload: { ...off, active: true }, customer: inactive, store }), { status: 409 });
  await assert.rejects(saveClientStatus({ payload: { ...payload(), active: true }, customer: inactive, store }), { status: 409 });
  await saveClientStatus({ payload: { ...payload(), recordRevision: inactive.recordRevision, active: true }, customer: inactive, store });
  const reactivated = await model();
  assert.equal(reactivated.customers[0].active, true);
  assert.equal(followUpRows(reactivated.customers).length, 2);
  assert.deepEqual(reactivated.customers[0].dogs.map((dog) => dog.dueDate), initial.dogs.map((dog) => dog.dueDate));
  assert.equal(reactivated.customers[0].totalPaid, 90);
});

test("status changes need no contact details and reject non-boolean values", async () => {
  const { store } = memoryStore();
  const customer = { id: "people/empty", name: "Old customer", emails: [], phones: [], dogs: [] };
  for (const active of ["false", null, undefined, 0]) {
    await assert.rejects(saveClientStatus({ payload: { ...payload(), active }, customer, store }), { status: 400 });
  }
  await saveClientStatus({ payload: { ...payload(), active: false }, customer, store });
  assert.equal(buildCrm({ ...await store.readAll(), now }).customers[0].active, false);
});

test("contact edits and a later calendar booking do not reactivate an inactive client", async () => {
  const { store } = memoryStore();
  let customer = buildCrm({ events: [booking], now }).customers[0];
  await saveClientStatus({ payload: { ...payload(), active: false }, customer, store });
  customer = buildCrm({ events: [booking], ...await store.readAll(), now }).customers[0];
  await saveClientPricing({ payload: { ...payload(), recordRevision: customer.recordRevision, groomPrice: "75.50" }, customer, store });
  customer = buildCrm({ events: [booking], ...await store.readAll(), now }).customers[0];
  await saveClient({ payload: { ...payload(), recordRevision: customer.recordRevision, name: "Alex New", email: "new@example.com", phone: "" }, customer, store,
    readContacts: async () => [], people: { people: { createContact: async () => ({ data: { resourceName: "people/new" } }) } },
  });
  const refreshed = buildCrm({ now, ...await store.readAll(), events: [booking, { ...booking, id: "new-booking" }],
    contacts: [{ resourceName: "people/new", names: [{ displayName: "Alex New" }], emailAddresses: [{ value: "new@example.com" }] }],
  });
  assert.equal(refreshed.customers.length, 1);
  assert.equal(refreshed.customers[0].active, false);
  assert.equal(refreshed.customers[0].groomPrice, 75.5);
  assert.equal(refreshed.customers[0].history.length, 2);
  assert.equal(followUpRows(refreshed.customers).length, 0);
});

test("customer pricing supports overrides, free grooms and clearing, without changing status or contact details", async () => {
  const { store, cells } = memoryStore();
  const base = { id: "people/price", name: "Alex", emails: [], phones: [], dogs: [], active: false };
  const input = { ...payload(), groomPrice: "85.25" };
  await saveClientPricing({ payload: input, customer: base, store });
  await saveClientPricing({ payload: input, customer: base, store });
  assert.equal(cells.Clients.length, 2);
  let customer = buildCrm({ ...await store.readAll(), now }).customers[0];
  assert.equal(customer.groomPrice, 85.25);
  assert.equal(customer.active, false);
  for (const groomPrice of [-1, "2.555", "no", true, " ", 10001, undefined]) {
    await assert.rejects(saveClientPricing({ payload: { ...payload(), recordRevision: customer.recordRevision, groomPrice }, customer, store }), { status: 400 });
  }
  await assert.rejects(saveClientPricing({ payload: { ...payload(), groomPrice: "90" }, customer, store }), { status: 409 });
  await saveClientPricing({ payload: { ...payload(), recordRevision: customer.recordRevision, groomPrice: "0" }, customer, store });
  customer = buildCrm({ ...await store.readAll(), now }).customers[0];
  assert.equal(customer.groomPrice, 0);
  await saveClientPricing({ payload: { ...payload(), recordRevision: customer.recordRevision, groomPrice: "" }, customer, store });
  customer = buildCrm({ ...await store.readAll(), now }).customers[0];
  assert.equal(customer.groomPrice, null);
  assert.equal(customer.active, false);
  assert.equal(customer.name, "Alex");
});
