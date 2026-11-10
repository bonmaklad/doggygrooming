import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarMonths, buildCrm, localDateKey, normalizePhone, parseAppointment } from "../lib/crm.js";
import { formatDate } from "../app/admin/components/format.js";

const now = new Date("2026-11-10T00:00:00Z");
const event = (id, start, extra = {}) => ({
  id, status: "confirmed", summary: "Full Groom — Poppy (Small) — Alex",
  start: { dateTime: start }, end: { dateTime: new Date(Date.parse(start) + 7200000).toISOString() },
  description: "Service: Full Groom\nDog size: Small\nDog name: Poppy\nOwner: Alex\nEmail: alex@example.com\nPhone: 021 123 4567\nNotes: Gentle care, please.",
  ...extra,
});
const contact = (id, name, emails, phones = []) => ({ resourceName: id, names: [{ displayName: name }], emailAddresses: emails.map((value) => ({ value })), phoneNumbers: phones.map((value) => ({ value })) });

test("calendar-month addition clamps month ends and leap years", () => {
  assert.equal(addCalendarMonths("2026-08-31", 6), "2027-02-28");
  assert.equal(addCalendarMonths("2023-08-31", 6), "2024-02-29");
  assert.equal(addCalendarMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addCalendarMonths("2026-05-10", 6), "2026-11-10");
});

test("NZ time and phone identities normalize consistently", () => {
  assert.equal(localDateKey("2026-11-09T12:00:00Z"), "2026-11-10");
  assert.equal(normalizePhone("021 123 4567"), normalizePhone("+64 21 123 4567"));
  assert.equal(normalizePhone("0064 21 123 4567"), normalizePhone("+64 21 123 4567"));
});

test("date-only labels stay on the selected day during Auckland daylight saving", () => {
  assert.equal(formatDate("2026-11-10", "Pacific/Auckland"), "10 Nov 2026");
  assert.equal(formatDate("2026-11-30", "Pacific/Auckland"), "30 Nov 2026");
  assert.equal(formatDate("2026-11-09T12:00:00Z", "Pacific/Auckland"), "10 Nov 2026");
});

test("old website bookings preserve multiline notes and cannot inject identity fields through notes", () => {
  const parsed = parseAppointment(event("a", "2026-05-10T01:00:00Z", { description: "Owner: Alex\nEmail: real@example.com\nDog size: Small\nNotes: Line one\nEmail: fake@example.com\nAmount paid: 999\nLine two" }));
  assert.equal(parsed.email, "real@example.com");
  assert.equal(parsed.amountPaid, null);
  assert.match(parsed.notes, /Line two/);
});

test("HTML fields and calendar invitation attendees are readable", () => {
  const parsed = parseAppointment(event("a", "2026-05-10T01:00:00Z", { description: "<b>Dog size:</b> Medium<br>Dog name: Teddy<br>Owner:<br>Sam &amp; Jo", attendees: [{ email: "groomer@example.com", organizer: true }, { email: "sam@example.com" }] }));
  assert.equal(parsed.dogSize, "Medium");
  assert.equal(parsed.name, "Sam & Jo");
  assert.equal(parsed.email, "sam@example.com");
});

test("all aliases and NZ phone forms join a contact's booking history", () => {
  const a = event("a", "2026-05-10T01:00:00Z");
  const b = event("b", "2026-06-10T01:00:00Z", { description: "Service: Full Groom\nDog name: Poppy\nDog size: Small\nOwner: Alex\nEmail: second@example.com\nPhone: +64 21 123 4567" });
  const crm = buildCrm({ now, events: [a, b], contacts: [contact("people/1", "Alex Smith", ["ALEX@example.com", "second@example.com"])] });
  assert.equal(crm.customers.length, 1);
  assert.equal(crm.customers[0].pastBookings, 2);
  assert.equal(crm.customers[0].name, "Alex Smith");
  assert.equal(crm.customers[0].dogs.length, 1);
});

test("contacts without bookings remain visible and same-name owners aren't merged", () => {
  const crm = buildCrm({ now, contacts: [contact("people/a", "Alex", ["a@example.com"]), contact("people/b", "Alex", ["b@example.com"])] });
  assert.equal(crm.customers.length, 2);
  assert.equal(crm.customers[0].pastBookings, 0);
  assert.equal(crm.customers[0].dogs.length, 0);
});

test("small, medium and large dogs have independent 6, 4 and 3 month due dates", () => {
  const events = [
    event("s", "2026-05-10T01:00:00Z"),
    event("m", "2026-07-20T01:00:00Z", { extendedProperties: { private: { ccDogName: "Milo", ccDogSize: "Medium" } } }),
    event("l", "2026-07-10T01:00:00Z", { extendedProperties: { private: { ccDogName: "Bear", ccDogSize: "Large" } } }),
  ];
  const dogs = buildCrm({ now, events }).customers[0].dogs;
  assert.equal(dogs.find((dog) => dog.name === "Poppy").dueDate, "2026-11-10");
  assert.equal(dogs.find((dog) => dog.name === "Poppy").status, "this-month");
  assert.equal(dogs.find((dog) => dog.name === "Milo").dueDate, "2026-11-20");
  assert.equal(dogs.find((dog) => dog.name === "Bear").dueDate, "2026-10-10");
  assert.equal(dogs.find((dog) => dog.name === "Bear").status, "overdue");
});

test("a future booking suppresses only that dog's due reminder", () => {
  const crm = buildCrm({ now, events: [event("past", "2026-01-10T01:00:00Z"), event("future", "2026-11-20T00:00:00Z"), event("other", "2026-01-10T01:00:00Z", { extendedProperties: { private: { ccDogName: "Bear", ccDogSize: "Large" } } })] });
  assert.equal(crm.customers[0].dogs.find((dog) => dog.name === "Poppy").status, "booked");
  assert.equal(crm.customers[0].dogs.find((dog) => dog.name === "Bear").status, "overdue");
});

test("no-shows and cancelled events don't reset a dog's cycle or count as visits", () => {
  const crm = buildCrm({ now, events: [event("old", "2026-01-10T01:00:00Z"), event("missed", "2026-09-10T01:00:00Z", { extendedProperties: { private: { ccAttendance: "no-show" } } }), event("cancelled", "2026-10-10T01:00:00Z", { status: "cancelled" })] });
  assert.equal(crm.customers[0].pastBookings, 1);
  assert.equal(crm.customers[0].dogs[0].dueDate, "2026-07-10");
  assert.equal(crm.customers[0].history.length, 2);
});

test("quotes aren't payments; free visits and known charges are counted accurately", () => {
  const crm = buildCrm({ now, events: [event("unknown", "2026-01-10T01:00:00Z"), event("quote", "2026-02-10T01:00:00Z", { extendedProperties: { private: { ccQuotedPrice: "90" } } }), event("free", "2026-03-10T01:00:00Z", { extendedProperties: { private: { ccAmountPaid: "0", ccAttendance: "attended" } } }), event("paid", "2026-04-10T01:00:00Z", { extendedProperties: { private: { ccAmountPaid: "95.50", ccAttendance: "attended" } } })] });
  assert.equal(crm.customers[0].totalPaid, 95.5);
  assert.equal(crm.customers[0].paidBookingCount, 2);
  assert.equal(crm.customers[0].confirmedVisits, 2);
});

test("unknown sizes and unrecognised calendar events aren't guessed", () => {
  const crm = buildCrm({ now, events: [event("unknown", "2026-01-10T01:00:00Z", { summary: "Groom", description: "Owner: Alex\nEmail: alex@example.com", attendees: [{ email: "alex@example.com" }] }), { id: "lunch", summary: "Lunch break", start: { dateTime: "2026-11-11T00:00:00Z" }, end: { dateTime: "2026-11-11T01:00:00Z" } }] });
  assert.equal(crm.customers[0].dogs[0].status, "needs-details");
  assert.equal(crm.customers[0].dogs[0].dueDate, null);
  assert.equal(crm.unrecognized.length, 1);
});

test("private corrections override old description fields", () => {
  const parsed = parseAppointment(event("a", "2026-01-10T01:00:00Z", { extendedProperties: { private: { ccDogSize: "Medium", ccDogName: "Teddy", ccAmountPaid: "120" } } }));
  assert.equal(parsed.dogSize, "Medium");
  assert.equal(parsed.dogName, "Teddy");
  assert.equal(parsed.amountPaid, 120);
});

test("unnamed dogs need review rather than merging an owner's pets into a guessed due date", () => {
  const crm = buildCrm({ now, events: [event("unnamed", "2026-01-10T01:00:00Z", { summary: "Full Groom", extendedProperties: { private: { ccDogName: "" } } })] });
  assert.equal(crm.customers[0].dogs[0].dueDate, null);
  assert.equal(crm.customers[0].dogs[0].status, "needs-details");
});
