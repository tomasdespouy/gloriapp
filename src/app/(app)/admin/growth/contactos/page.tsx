import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import ContactosClient from "./ContactosClient";

export default async function ContactosPage() {
  const ctx = await getAdminContext();
  if (!ctx.isSuperadmin) redirect("/admin/dashboard");

  const supabase = await createClient();

  const { data: schools } = await supabase
    .from("growth_schools")
    .select("id, name, country, city, website, notes, status, created_at")
    .order("name");

  const { data: contacts } = await supabase
    .from("growth_contacts")
    .select("id, school_id, full_name, email, role_title, phone, notes, status, created_at, growth_schools(name, country)")
    .order("created_at", { ascending: false });

  return (
    <ContactosClient
      schools={schools || []}
      contacts={(contacts || []).map((c) => ({
        ...c,
        schoolName: (c.growth_schools as unknown as { name: string } | null)?.name || "—",
        schoolCountry: (c.growth_schools as unknown as { country: string } | null)?.country || "—",
      }))}
    />
  );
}
