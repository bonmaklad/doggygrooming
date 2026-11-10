import { adminJson, guardAdmin } from "../../../../lib/adminAuth";
import { loadGoogleCrm } from "../../../../lib/googleCrm";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const denied = await guardAdmin(request);
  if (denied) return denied;
  try {
    return adminJson(await loadGoogleCrm());
  } catch {
    return adminJson({ error: "Unable to load Google Calendar. Check the server's Google credentials, calendar access and API configuration, then refresh." }, 503);
  }
}
