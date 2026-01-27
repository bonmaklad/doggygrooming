import { NextResponse } from "next/server";
import { isSlotWithinSchedule } from "../../../lib/availability";
import { getCalendarClient, getCalendarConfig } from "../../../lib/googleCalendar";

const SESSION_MINUTES = 120;
const SCHEDULE = {
  Friday: { start: "09:00", end: "17:00" },
  Saturday: { start: "09:00", end: "13:00" },
};
const ALLOWED_SERVICES = [
  "Wash & Blow Dry",
  "Basic Trim",
  "Full Groom",
  "De-Shed Treatment",
];
const ALLOWED_SIZES = ["Small", "Medium", "Large"];

const sanitize = (value) => (typeof value === "string" ? value.trim() : "");

export async function POST(request) {
  try {
    const payload = await request.json();
    const name = sanitize(payload?.name);
    const email = sanitize(payload?.email);
    const phone = sanitize(payload?.phone);
    const dogName = sanitize(payload?.dogName);
    const dogSize = sanitize(payload?.dogSize);
    const service = sanitize(payload?.service);
    const notes = sanitize(payload?.notes);
    const start = sanitize(payload?.start);
    const end = sanitize(payload?.end);

    if (!name || !email || !service || !dogSize || !start || !end) {
      return NextResponse.json(
        { error: "Missing required booking details." },
        { status: 400 }
      );
    }

    if (!ALLOWED_SERVICES.includes(service) || !ALLOWED_SIZES.includes(dogSize)) {
      return NextResponse.json({ error: "Invalid service details." }, { status: 400 });
    }

    const { calendarId, timeZone } = getCalendarConfig();
    const calendar = getCalendarClient();

    if (
      !isSlotWithinSchedule({
        start,
        end,
        schedule: SCHEDULE,
        timeZone,
        sessionMinutes: SESSION_MINUTES,
      })
    ) {
      return NextResponse.json(
        { error: "Selected slot is outside available hours." },
        { status: 400 }
      );
    }

    const slotStart = new Date(start);
    const slotEnd = new Date(end);
    if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
      return NextResponse.json({ error: "Invalid slot time." }, { status: 400 });
    }

    const busyCheck = await calendar.freebusy.query({
      requestBody: {
        timeMin: slotStart.toISOString(),
        timeMax: slotEnd.toISOString(),
        timeZone,
        items: [{ id: calendarId }],
      },
    });

    const busy = busyCheck.data.calendars?.[calendarId]?.busy || [];
    if (busy.length) {
      return NextResponse.json(
        { error: "That time was just booked. Please choose another slot." },
        { status: 409 }
      );
    }

    const summaryParts = [
      service,
      dogName ? `${dogName} (${dogSize})` : dogSize,
      name,
    ].filter(Boolean);
    const summary = summaryParts.join(" — ");

    const descriptionLines = [
      `Service: ${service}`,
      `Dog size: ${dogSize}`,
      dogName ? `Dog name: ${dogName}` : null,
      `Owner: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean);

    const event = await calendar.events.insert({
      calendarId,
      sendUpdates: "all",
      requestBody: {
        summary,
        description: descriptionLines.join("\n"),
        start: {
          dateTime: slotStart.toISOString(),
          timeZone,
        },
        end: {
          dateTime: slotEnd.toISOString(),
          timeZone,
        },
        attendees: email ? [{ email }] : [],
      },
    });

    return NextResponse.json({
      eventId: event.data.id,
      htmlLink: event.data.htmlLink,
    });
  } catch (error) {
    const message = error?.message || "Unable to book the appointment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
