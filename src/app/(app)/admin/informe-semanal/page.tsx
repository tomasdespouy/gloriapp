import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/user-profile";
import InformeSemanalClient from "./InformeSemanalClient";

/**
 * Panel del informe semanal: quién lo recibe, qué corridas hubo y qué pasó con
 * cada correo. Solo superadmin — la lista de distribución decide a quién sale
 * información de uso de una institución.
 */
export default async function InformeSemanalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const perfil = await getUserProfile();
  if (perfil?.realRole !== "superadmin") redirect("/admin/dashboard");

  const admin = createAdminClient();

  const [{ data: establecimientos }, { data: suscripciones }, { data: corridas }] = await Promise.all([
    admin.from("establishments").select("id, name").eq("is_active", true).order("name"),
    admin.from("report_subscriptions").select("*").order("created_at"),
    admin.from("report_runs")
      .select("id, establishment_id, period_key, status, recipients, sent_count, failed_count, note, triggered_by, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(30),
  ]);

  // Detalle por destinatario de las corridas que se muestran.
  const runIds = (corridas || []).map((c) => c.id);
  const { data: entregas } = runIds.length
    ? await admin.from("report_deliveries")
        .select("run_id, email, success, error, sent_at, delivery_status, delivery_at")
        .in("run_id", runIds)
        .order("sent_at")
    : { data: [] };

  // El webhook de Resend es opcional: sin él se sabe qué salió, no qué llegó.
  const seguimientoEntrega = !!process.env.RESEND_WEBHOOK_SECRET;

  return (
    <InformeSemanalClient
      establecimientos={(establecimientos || []) as { id: string; name: string }[]}
      suscripciones={(suscripciones || []) as never[]}
      corridas={(corridas || []) as never[]}
      entregas={(entregas || []) as never[]}
      seguimientoEntrega={seguimientoEntrega}
    />
  );
}
