import { getAdminContext } from "@/lib/admin-helpers";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboard() {
  await getAdminContext(); // Auth guard — redirects non-admins
  return <AdminDashboardClient />;
}
