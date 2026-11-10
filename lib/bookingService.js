import { createHash } from "node:crypto";
import { isSlotWithinSchedule } from "./availability.js";
import { BOOKING_AVAILABILITY_WEEKS, BOOKING_SCHEDULE, BOOKING_SESSION_MINUTES, SERVICE_PRICES } from "./bookingConfig.js";
import { getCalendarClient, getCalendarConfig } from "./googleCalendar.js";

export class BookingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const text = (value) => typeof value === "string" ? value.trim() : "";

export const validateBooking = (payload, timeZone, now = Date.now()) => {
  const booking = Object.fromEntries(["name", "email", "phone", "dogName", "dogSize", "service", "notes", "start", "end"].map((key) => [key, text(payload?.[key])]));
  if (!booking.name || !booking.email || !booking.dogSize || !booking.service || !booking.start || !booking.end) {
    throw new BookingError("Please enter the customer, email, service, dog size and appointment time.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email) || booking.email.length > 254) throw new BookingError("Please enter a valid customer email for the confirmation.");
  if (["name", "dogName"].some((key) => booking[key].length > 120) || booking.phone.length > 50 || booking.notes.length > 2000 || [booking.name, booking.email, booking.phone, booking.dogName].some((value) => /[\r\n]/.test(value))) {
    throw new BookingError("Please shorten the booking details and use a single line for contact fields.");
  }
  if (!Object.hasOwn(SERVICE_PRICES, booking.service) || !Object.hasOwn(SERVICE_PRICES[booking.service], booking.dogSize)) throw new BookingError("Please choose a valid service and dog size.");
  if (!isSlotWithinSchedule({ start: booking.start, end: booking.end, schedule: BOOKING_SCHEDULE, timeZone, sessionMinutes: BOOKING_SESSION_MINUTES })) {
    throw new BookingError("Selected time is outside the available appointment slots.");
  }
  if (Date.parse(booking.start) <= now || Date.parse(booking.start) > now + BOOKING_AVAILABILITY_WEEKS * 7 * 86400000) {
    throw new BookingError("Please choose a future slot from the available booking dates.");
  }
  return booking;
};

export const requireFreeCalendar = (data, calendarId) => {
  const result = data.calendars?.[calendarId];
  if (!result || result.errors?.length || !Array.isArray(result.busy)) throw new BookingError("Calendar availability could not be verified. Please try again.", 503);
  return result.busy;
};

export const createCalendarBooking = async (payload, { source = "website", calendar = getCalendarClient(), config = getCalendarConfig() } = {}) => {
  const { calendarId, timeZone } = config;
  const booking = validateBooking(payload, timeZone);
  if (source === "admin" && !booking.dogName) throw new BookingError("Please enter the dog's name so its follow-up can be tracked.");
  if (source === "admin" && payload.quotedPrice !== undefined && (payload.quotedPrice === null || String(payload.quotedPrice).trim() === "")) throw new BookingError("Please enter a quoted price.");
  const quotedPrice = source === "admin" && payload.quotedPrice !== undefined ? Number(payload.quotedPrice) : SERVICE_PRICES[booking.service][booking.dogSize];
  if (!Number.isFinite(quotedPrice) || quotedPrice < 0 || quotedPrice > 10000 || Math.abs(quotedPrice * 100 - Math.round(quotedPrice * 100)) > 0.00001) throw new BookingError("Please enter a valid quoted price.");
  let eventId;
  if (source === "admin") {
    if (!/^[a-f0-9-]{36}$/i.test(payload.requestId || "")) throw new BookingError("Please reopen the booking form and try again.");
    eventId = createHash("sha256").update(`cut-cuddle:${payload.requestId}`).digest("hex");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...booking, quotedPrice })).digest("hex");
  const result = (event) => ({ eventId: event.id, htmlLink: event.htmlLink });
  const readExisting = async () => {
    try {
      const existing = await calendar.events.get({ calendarId, eventId });
      if (existing.data.status === "cancelled" || existing.data.extendedProperties?.private?.ccRequestHash !== fingerprint) throw new BookingError("This booking request was already used. Reopen the form to book another appointment.", 409);
      return result(existing.data);
    } catch (error) { if (Number(error.code) !== 404) throw error; return null; }
  };
  if (eventId) { const existing = await readExisting(); if (existing) return existing; }
  const busyCheck = await calendar.freebusy.query({ requestBody: {
    timeMin: new Date(booking.start).toISOString(), timeMax: new Date(booking.end).toISOString(), timeZone, items: [{ id: calendarId }],
  } });
  if (requireFreeCalendar(busyCheck.data, calendarId).length) throw new BookingError("That time was just booked. Please choose another slot.", 409);
  const description = [
    `Service: ${booking.service}`, `Dog size: ${booking.dogSize}`,
    booking.dogName ? `Dog name: ${booking.dogName}` : null,
    `Owner: ${booking.name}`, `Email: ${booking.email}`,
    booking.phone ? `Phone: ${booking.phone}` : null,
    `Price: NZD ${quotedPrice.toFixed(2)}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ].filter(Boolean).join("\n");
  try {
    const response = await calendar.events.insert({ calendarId, sendUpdates: "all", requestBody: {
      ...(eventId ? { id: eventId } : {}),
      summary: [booking.service, booking.dogName ? `${booking.dogName} (${booking.dogSize})` : booking.dogSize, booking.name].join(" — "),
      description,
      start: { dateTime: new Date(booking.start).toISOString(), timeZone },
      end: { dateTime: new Date(booking.end).toISOString(), timeZone },
      attendees: [{ email: booking.email }],
      extendedProperties: { private: {
        ccBooking: "1", ccSource: source, ccOwner: booking.name, ccEmail: booking.email,
        ccPhone: booking.phone, ccDogName: booking.dogName, ccDogSize: booking.dogSize,
        ccService: booking.service, ccQuotedPrice: String(quotedPrice), ccRequestHash: fingerprint,
      } },
    } });
    return result(response.data);
  } catch (error) {
    if (eventId && Number(error.code) === 409) { const existing = await readExisting(); if (existing) return existing; }
    throw error;
  }
};
