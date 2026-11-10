import { adminJson, guardAdmin } from "../../../../lib/adminAuth";
import { BookingError, createCalendarBooking } from "../../../../lib/bookingService";

export async function POST(request) {
  const denied = await guardAdmin(request, true);
  if (denied) return denied;
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid booking details." }, 400); }
  try {
    return adminJson(await createCalendarBooking(payload, { source: "admin" }));
  } catch (error) {
    return adminJson({ error: error instanceof BookingError ? error.message : "The booking could not be confirmed. Please try again; retrying this form won't create a duplicate." }, error instanceof BookingError ? error.status : 503);
  }
}
