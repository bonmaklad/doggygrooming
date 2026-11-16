import { adminJson, guardAdmin } from "../../../../../lib/adminAuth";
import { getCalendarConfig } from "../../../../../lib/googleCalendar";
import { getCrmStore, loadGoogleCrm } from "../../../../../lib/googleCrm";
import { visitDetails } from "../../../../../lib/crmRecords";

export async function PATCH(request, { params }) {
  const denied = await guardAdmin(request, true);
  if (denied) return denied;
  params = await params;
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid appointment details." }, 400); }
  try {
    const crm = await loadGoogleCrm();
    const appointment = crm.customers.flatMap((customer) => customer.history).find((item) => item.id === params.id);
    if (!appointment) return adminJson({ error: "This appointment could not be found. Refresh and try again." }, 404);
    if (payload.calendarVersion !== appointment.calendarVersion) return adminJson({ error: "This booking changed in Calendar. Refresh before saving." }, 409);
    const { calendarId } = getCalendarConfig();
    const details = visitDetails(payload, appointment, crm.timeZone);
    await getCrmStore().save("Visits", { id: appointment.id, calendarId, start: appointment.start, end: appointment.end, name: appointment.name, email: appointment.email, phone: appointment.phone, ...details }, payload.recordRevision, payload.requestId);
    return adminJson({ ok: true });
  } catch (error) {
    return adminJson({ error: error.status ? error.message : "Unable to save the appointment record. Refresh and try again." }, error.status || 503);
  }
}
