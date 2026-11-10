import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildAvailabilitySlots, isSlotWithinSchedule } from "../lib/availability.js";
import { BOOKING_SCHEDULE, BOOKING_SESSION_MINUTES } from "../lib/bookingConfig.js";
import { createCalendarBooking, requireFreeCalendar, validateBooking } from "../lib/bookingService.js";

const config = { calendarId: "grooming", timeZone: "Pacific/Auckland" };
const futureSlot = () => buildAvailabilitySlots({ startDate: new Date(Date.now() + 86400000), weeks: 2, sessionMinutes: BOOKING_SESSION_MINUTES, schedule: BOOKING_SCHEDULE, timeZone: config.timeZone, busy: [] })[0].slots[0];
const payload = () => ({ name: "Alex", email: "alex@example.com", phone: "021 123 4567", dogName: "Poppy", dogSize: "Small", service: "Full Groom", notes: "Nervous around dryers.", ...futureSlot(), requestId: randomUUID(), quotedPrice: 95 });
const mockCalendar = (busy = []) => {
  const stored = new Map();
  const calls = [];
  return { calls, stored, freebusy: { query: async () => ({ data: { calendars: { grooming: { busy } } } }) }, events: {
    get: async ({ eventId }) => { if (!stored.has(eventId)) throw Object.assign(new Error("Not found"), { code: 404 }); return { data: stored.get(eventId) }; },
    insert: async (request) => {
      if (stored.has(request.requestBody.id)) throw Object.assign(new Error("Already exists"), { code: 409 });
      calls.push(request);
      const data = { ...request.requestBody, id: request.requestBody.id || "created", htmlLink: "https://calendar.google.com/event" };
      stored.set(data.id, data);
      return { data };
    },
  } };
};

test("admin rebooking includes the customer, quote, dog details and confirmation instruction", async () => {
  const calendar = mockCalendar();
  const result = await createCalendarBooking(payload(), { source: "admin", calendar, config });
  assert.equal(calendar.calls.length, 1);
  assert.equal(calendar.calls[0].sendUpdates, "all");
  assert.equal(calendar.calls[0].requestBody.attendees[0].email, "alex@example.com");
  assert.equal(calendar.calls[0].requestBody.extendedProperties.private.ccQuotedPrice, "95");
  assert.equal(calendar.calls[0].requestBody.extendedProperties.private.ccDogName, "Poppy");
  assert.match(calendar.calls[0].requestBody.description, /Price: NZD 95.00/);
  assert.ok(result.eventId);
});

test("retrying an admin booking doesn't create another event or invitation", async () => {
  const calendar = mockCalendar();
  const body = payload();
  const first = await createCalendarBooking(body, { source: "admin", calendar, config });
  const second = await createCalendarBooking(body, { source: "admin", calendar, config });
  assert.deepEqual(first, second);
  assert.equal(calendar.calls.length, 1);
  await assert.rejects(createCalendarBooking({ ...body, dogName: "Different dog" }, { source: "admin", calendar, config }), (error) => error.status === 409);
});

test("simultaneous retries of an admin form still create only one event", async () => {
  const calendar = mockCalendar();
  const body = payload();
  const results = await Promise.all([createCalendarBooking(body, { source: "admin", calendar, config }), createCalendarBooking(body, { source: "admin", calendar, config })]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(calendar.calls.length, 1);
});

test("missing dog names and blank quotes are rejected for admin bookings", async () => {
  const calendar = mockCalendar();
  for (const patch of [{ dogName: "" }, { quotedPrice: "" }, { quotedPrice: null }]) {
    await assert.rejects(createCalendarBooking({ ...payload(), ...patch }, { source: "admin", calendar, config }), (error) => error.status === 400);
  }
  assert.equal(calendar.calls.length, 0);
});

test("known occupied slots reject a booking before any invitation is created", async () => {
  const body = payload();
  const calendar = mockCalendar([{ start: body.start, end: body.end }]);
  await assert.rejects(createCalendarBooking(body, { source: "admin", calendar, config }), (error) => error.status === 409);
  assert.equal(calendar.calls.length, 0);
});

test("calendar-level availability errors fail closed", () => {
  for (const data of [{}, { calendars: {} }, { calendars: { grooming: { errors: [{ reason: "notFound" }] } } }, { calendars: { grooming: {} } }]) {
    assert.throws(() => requireFreeCalendar(data, config.calendarId), (error) => error.status === 503);
  }
});

test("public bookings use the same confirmation and fixed price, ignoring admin-only fields", async () => {
  const calendar = mockCalendar();
  await createCalendarBooking({ ...payload(), quotedPrice: 1 }, { calendar, config });
  assert.equal(calendar.calls[0].sendUpdates, "all");
  assert.equal(calendar.calls[0].requestBody.extendedProperties.private.ccQuotedPrice, "90");
  assert.equal(calendar.calls[0].requestBody.extendedProperties.private.ccSource, "website");
});

test("booking validation rejects past, off-grid, unsupported and malformed requests", () => {
  const valid = payload();
  assert.equal(validateBooking(valid, config.timeZone).dogSize, "Small");
  for (const patch of [{ email: "bad-email" }, { dogSize: "Tiny" }, { service: "__proto__" }, { name: "Alex\nEmail: bad@example.com" }, { notes: "x".repeat(2001) }, { start: "2020-01-01T00:00:00Z", end: "2020-01-01T02:00:00Z" }, { start: new Date(Date.parse(valid.start) + 1800000).toISOString(), end: new Date(Date.parse(valid.end) + 1800000).toISOString() }]) {
    assert.throws(() => validateBooking({ ...valid, ...patch }, config.timeZone));
  }
});

test("availability skips sessions already underway and respects daylight saving", () => {
  const days = buildAvailabilitySlots({ startDate: new Date(), weeks: 13, sessionMinutes: 120, schedule: BOOKING_SCHEDULE, timeZone: config.timeZone, busy: [] });
  assert.ok(days.length > 0);
  for (const day of days) for (const slot of day.slots) {
    assert.ok(Date.parse(slot.start) > Date.now());
    assert.equal(isSlotWithinSchedule({ ...slot, schedule: BOOKING_SCHEDULE, timeZone: config.timeZone, sessionMinutes: 120 }), true);
  }
});
