import { adminJson, guardAdmin } from "../../../../lib/adminAuth";
import { loadGoogleCrm } from "../../../../lib/googleCrm";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    return adminJson(await loadGoogleCrm());
  } catch (error) {
    return adminJson({ error: error.status ? error.message : "Unable to load Google records. Check Calendar and Sheets access and API configuration, then refresh." }, 503);
  }
}
