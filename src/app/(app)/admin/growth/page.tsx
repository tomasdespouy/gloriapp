import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import GrowthDashboardClient from "./GrowthDashboardClient";

export default async function GrowthPage() {
  const ctx = await getAdminContext();
  if (!ctx.isSuperadmin) redirect("/admin/dashboard");

  const supabase = await createClient();

  // Fetch schools with contact counts
  const { data: schools } = await supabase
    .from("growth_schools")
    .select("id, name, country, status, created_at, growth_contacts(count)")
    .order("created_at", { ascending: false });

  // Fetch recent email logs
  const { data: recentEmails } = await supabase
    .from("growth_email_log")
    .select("id, subject, status, sent_at, growth_contacts(full_name, email)")
    .order("sent_at", { ascending: false })
    .limit(10);

  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from("growth_campaigns")
    .select("id, name, status, total_sent, sent_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch active drip sequences
  const { data: sequences } = await supabase
    .from("growth_drip_sequences")
    .select("id, name, is_active, growth_enrollments(count)")
    .order("created_at", { ascending: false });

  // KPIs
  const { count: totalContacts } = await supabase
    .from("growth_contacts")
    .select("id", { count: "exact", head: true });

  const { count: totalSent } = await supabase
    .from("growth_email_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent");

  // Status distribution
  const statusCounts: Record<string, number> = {};
  schools?.forEach((s) => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  // Country distribution
  const countryCounts: Record<string, number> = {};
  schools?.forEach((s) => {
    countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
  });

  return (
    <GrowthDashboardClient
      totalSchools={schools?.length || 0}
      totalContacts={totalContacts || 0}
      totalEmailsSent={totalSent || 0}
      statusCounts={statusCounts}
      countryCounts={countryCounts}
      recentEmails={(recentEmails || []).map((e) => ({
        id: e.id,
        subject: e.subject,
        status: e.status,
        sent_at: e.sent_at,
        contactName: (e.growth_contacts as unknown as { full_name: string } | null)?.full_name || "—",
        contactEmail: (e.growth_contacts as unknown as { email: string } | null)?.email || "—",
      }))}
      campaigns={(campaigns || []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        total_sent: c.total_sent,
        sent_at: c.sent_at,
      }))}
      sequences={(sequences || []).map((s) => ({
        id: s.id,
        name: s.name,
        is_active: s.is_active,
        enrollments: (s.growth_enrollments as unknown as { count: number }[])?.[0]?.count || 0,
      }))}
    />
  );
}
