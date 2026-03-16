import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import CampanasClient from "./CampanasClient";

export default async function CampanasPage() {
  const ctx = await getAdminContext();
  if (!ctx.isSuperadmin) redirect("/admin/dashboard");

  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("growth_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("growth_contacts")
    .select("id, full_name, email, school_id, status, growth_schools(name, country)")
    .eq("status", "active")
    .order("full_name");

  return (
    <CampanasClient
      campaigns={campaigns || []}
      contacts={(contacts || []).map((c) => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        schoolName: (c.growth_schools as unknown as { name: string } | null)?.name || "—",
        schoolCountry: (c.growth_schools as unknown as { country: string } | null)?.country || "—",
      }))}
    />
  );
}
