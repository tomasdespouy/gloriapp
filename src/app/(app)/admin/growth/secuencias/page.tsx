import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import SecuenciasClient from "./SecuenciasClient";

export default async function SecuenciasPage() {
  const ctx = await getAdminContext();
  if (!ctx.isSuperadmin) redirect("/admin/dashboard");

  const supabase = await createClient();

  const { data: sequences } = await supabase
    .from("growth_drip_sequences")
    .select("*, growth_drip_steps(*), growth_enrollments(count)")
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("growth_contacts")
    .select("id, full_name, email, status, growth_schools(name)")
    .eq("status", "active")
    .order("full_name");

  return (
    <SecuenciasClient
      sequences={(sequences || []).map((s) => ({
        ...s,
        steps: (s.growth_drip_steps || []).sort(
          (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
        ),
        enrollmentCount: (s.growth_enrollments as unknown as { count: number }[])?.[0]?.count || 0,
      }))}
      contacts={(contacts || []).map((c) => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        schoolName: (c.growth_schools as unknown as { name: string } | null)?.name || "—",
      }))}
    />
  );
}
