import { adminJson, guardAdmin } from "../../../../../lib/adminAuth";
import { getCalendarClient, getCalendarConfig } from "../../../../../lib/googleCalendar";
import { parseAppointment } from "../../../../../lib/crm";
import { DOG_REBOOK_MONTHS, SERVICE_PRICES } from "../../../../../lib/bookingConfig";

export async function PATCH(request, { params }) {
  const denied = await guardAdmin(request, true);
  if (denied) return denied;
  params = await params;
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid appointment details." }, 400); }
  const dogName = typeof payload.dogName === "string" ? payload.dogName.trim() : "";
  const dogSize = payload.dogSize || "";
  const service = payload.service || "";
  const amountPaid = payload.amountPaid === "" || payload.amountPaid === null ? "" : Number(payload.amountPaid);
  if (!/^[a-zA-Z0-9_-]{1,1024}$/.test(params.id) || dogName.length > 120 || /[\r\n]/.test(dogName) ||
    (dogSize && !Object.hasOwn(DOG_REBOOK_MONTHS, dogSize)) || (service && !Object.hasOwn(SERVICE_PRICES, service)) ||
    !["unconfirmed", "attended", "no-show"].includes(payload.attendance) ||
    (amountPaid !== "" && (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > 10000 || Math.abs(amountPaid * 100 - Math.round(amountPaid * 100)) > 0.00001))) {
    return adminJson({ error: "Please check the dog, service, attendance and amount paid." }, 400);
  }
  try {
    const { calendarId } = getCalendarConfig();
    const calendar = getCalendarClient();
    const response = await calendar.events.get({ calendarId, eventId: params.id });
    const event = response.data;
    if (!parseAppointment(event)) return adminJson({ error: "This event isn't a customer appointment." }, 400);
    if (Date.parse(event.end.dateTime) > Date.now() && (amountPaid !== "" || payload.attendance !== "unconfirmed")) {
      return adminJson({ error: "Record attendance and payment after the appointment." }, 400);
    }
    await calendar.events.patch({
      calendarId, eventId: params.id, sendUpdates: "none",
      requestBody: { extendedProperties: { private: {
        ...event.extendedProperties?.private,
        ccDogName: dogName, ccDogSize: dogSize, ccService: service,
        ccAmountPaid: String(amountPaid), ccAttendance: payload.attendance,
      } } },
    }, { headers: { "If-Match": event.etag } });
    return adminJson({ ok: true });
  } catch (error) {
    return adminJson({ error: Number(error.code) === 412 ? "This booking changed elsewhere. Refresh and try again." : "Unable to save the appointment record. Please refresh and try again." }, Number(error.code) === 412 ? 409 : 503);
  }
}
