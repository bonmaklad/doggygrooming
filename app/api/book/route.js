import { NextResponse } from "next/server";
import { BookingError, createCalendarBooking } from "../../../lib/bookingService";

export async function POST(request) {
  let payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid booking details." }, { status: 400 }); }
  try {
    return NextResponse.json(await createCalendarBooking(payload));
  } catch (error) {
    return NextResponse.json({ error: error instanceof BookingError ? error.message : "Unable to book the appointment. Please try again or contact us." }, { status: error instanceof BookingError ? error.status : 503 });
  }
}
