import { NextResponse } from "next/server";
import { buildAvailabilitySlots } from "../../../lib/availability";
import {
  BOOKING_AVAILABILITY_WEEKS,
  BOOKING_SCHEDULE,
  BOOKING_SESSION_MINUTES,
} from "../../../lib/bookingConfig";
import { getCalendarClient, getCalendarConfig } from "../../../lib/googleCalendar";
import { requireFreeCalendar } from "../../../lib/bookingService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { calendarId, timeZone } = getCalendarConfig();
    const calendar = getCalendarClient();
    const url = new URL(request.url);
    const requestedWeeks = Number(
      url.searchParams.get("weeks") || BOOKING_AVAILABILITY_WEEKS
    );
    if (!Number.isInteger(requestedWeeks) || requestedWeeks < 1) {
      return NextResponse.json({ error: "Invalid availability range." }, { status: 400 });
    }
    const weeks = Math.min(requestedWeeks, BOOKING_AVAILABILITY_WEEKS);
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

    const busy = requireFreeCalendar(response.data, calendarId);
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
    return NextResponse.json({ error: "Unable to load availability. Please try again or contact us." }, { status: 503 });
  }
}
