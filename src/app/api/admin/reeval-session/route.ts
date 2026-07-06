import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateConversation } from "@/lib/session-evaluation";

// Re-dispara la evaluación IA (+ resumen + aviso al docente de la sección) de una
// conversación. Pensado para sesiones reales que quedaron sin evaluar (el
// evaluador LLM falló, o el alumno cerró el navegador sin "cerrar sesión").
// Reusa el motor central `evaluateConversation` — así también regenera el
// resumen (antes esta ruta solo hacía la eval). Crea session_competencies con
// feedback_status "pending" → entra a la cola de revisión del docente.
//
// Autorización: sesión de superadmin (botón en el panel) O Bearer CRON_SECRET
// (para correr lotes/cron server-to-server).
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const viaSecret = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!viaSecret) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "superadmin") {
      return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = body.conversationId as string | undefined;
  if (!conversationId) return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });

  const admin = createAdminClient();
  const result = await evaluateConversation(admin, conversationId, { notify: true });

  if (result.status === "skipped") {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }
    if (result.error === "already_approved") {
      // No re-evaluamos: pisaría la evaluación ya aprobada por el docente.
      return NextResponse.json({ error: "La evaluación ya fue aprobada por el docente; no se re-evalúa." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sesión muy corta para evaluar (sin conversación)" }, { status: 400 });
  }
  if (result.status === "error") {
    return NextResponse.json({ error: "Error al evaluar la sesión (LLM)" }, { status: 500 });
  }
  return NextResponse.json({ success: true, overall_score_v2: result.overall, reported: true });
}
