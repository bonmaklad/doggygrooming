import { adminJson, guardAdmin } from "../../../../lib/adminAuth";
import { getCrmStore, loadGoogleCrm, readContacts } from "../../../../lib/googleCrm";
import { getPeopleClient } from "../../../../lib/googleCalendar";
import { saveClient, saveClientPricing, saveClientStatus } from "../../../../lib/crmRecords";
import { normalizeEmail, normalizePhone } from "../../../../lib/crm";

export async function PATCH(request) {
  const denied = await guardAdmin(request, true);
  if (denied) return denied;
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid client details." }, 400); }
  try {
    const crm = await loadGoogleCrm();
    const customer = crm.customers.find((item) => item.id === payload.customerId);
    if (!customer) return adminJson({ error: "Client not found. Refresh and try again." }, 404);
    if (payload.action === "set-status") return adminJson(await saveClientStatus({ payload, customer, store: getCrmStore() }));
    if (payload.action === "set-pricing") return adminJson(await saveClientPricing({ payload, customer, store: getCrmStore() }));
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const phone = typeof payload.phone === "string" ? normalizePhone(payload.phone) : "";
    if (crm.customers.some((item) => item.id !== customer.id && ((email && item.emailAliases.includes(email)) || (phone && item.phoneAliases.some((value) => normalizePhone(value) === phone))))) return adminJson({ error: "That email or phone belongs to another client. Review the two records before changing it." }, 409);
    return adminJson(await saveClient({ payload, customer, store: getCrmStore(), people: getPeopleClient(), readContacts, contactGroup: process.env.GOOGLE_CONTACT_GROUP }));
  } catch (error) {
    return adminJson({ error: error.status ? error.message : "Unable to save client details. Refresh and try again." }, error.status || 503);
  }
}
