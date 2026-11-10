import { redirect } from "next/navigation";
import { isAdmin } from "../../../lib/adminAuth";
import CrmProvider from "../components/CrmProvider";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }) {
  if (!await isAdmin()) redirect("/admin");
  return <CrmProvider>{children}</CrmProvider>;
}
