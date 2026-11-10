import { redirect } from "next/navigation";
import { isAdmin } from "../../lib/adminAuth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (await isAdmin()) redirect("/admin/due");
  return <LoginForm />;
}
