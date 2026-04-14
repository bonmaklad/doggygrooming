import { NextResponse } from "next/server";
import { buildAvailabilitySlots } from "../../../lib/availability";
import {
  BOOKING_SCHEDULE,
  BOOKING_SESSION_MINUTES,
} from "../../../lib/bookingConfig";
import { getCalendarClient, getCalendarConfig } from "../../../lib/googleCalendar";

export async function GET(request) {
  try {
    const { calendarId, timeZone } = getCalendarConfig();
    const calendar = getCalendarClient();
    const url = new URL(request.url);
    const weeks = Math.min(Number(url.searchParams.get("weeks") || 6), 12);
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone,
        items: [{ id: calendarId }],
      },
    });

    const busy = response.data.calendars?.[calendarId]?.busy || [];
    const slots = buildAvailabilitySlots({
      startDate,
      weeks,
      sessionMinutes: BOOKING_SESSION_MINUTES,
      schedule: BOOKING_SCHEDULE,
      timeZone,
      busy,
    });

    return NextResponse.json({
      slots,
      sessionMinutes: BOOKING_SESSION_MINUTES,
      timeZone,
    });
  } catch (error) {
    const message = error?.message || "Unable to load availability.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
