import { adminJson, guardAdmin } from "../../../../lib/adminAuth";
import { getCrmStore, loadGoogleCrm } from "../../../../lib/googleCrm";
import { saveDog } from "../../../../lib/crmRecords";

export async function POST(request) {
  const denied = await guardAdmin(request, true);
  if (denied) return denied;
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid dog details." }, 400); }
  try {
    const crm = await loadGoogleCrm();
    const customer = crm.customers.find((item) => item.id === payload.customerId);
    if (!customer) return adminJson({ error: "Client not found. Refresh and try again." }, 404);
    return adminJson(await saveDog({ payload, customer, store: getCrmStore() }));
  } catch (error) {
    return adminJson({ error: error.status ? error.message : "Unable to save the dog profile. Refresh and try again." }, error.status || 503);
  }
}
