/**
 * Alarma de LLM: recuerda el último estado de cada proveedor y avisa por correo
 * cuando cambia. Lo alimentan dos fuentes:
 *
 *  - Sonda (/api/cron/llm-health): prueba ambos proveedores, también el que hoy
 *    no está atendiendo. Es la que detecta un respaldo agotado o un principal
 *    caído aunque el failover lo esté disimulando.
 *  - Detector (src/lib/ai.ts): una llamada real falló por saldo. Avisa sin esperar
 *    a la próxima corrida de la sonda.
 *
 * El estado vive en system_metrics (event = "llm_provider_status"): solo se
 * inserta una fila cuando hay algo que recordar, no en cada corrida.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logEmail } from "@/lib/email-log";
import type { LlmBillingKind, LlmProvider } from "@/lib/llm-outage";

const EVENT = "llm_provider_status";
/** Mientras siga agotado, se recuerda cada este tiempo. */
const REMINDER_MS = 6 * 60 * 60 * 1000;
/** El detector no consulta la base en cada llamada fallida de una misma instancia. */
const DETECTOR_COOLDOWN_MS = 60 * 60 * 1000;

export type ProviderStatus = "ok" | "billing" | "error";

type StatusRow = {
  provider: LlmProvider;
  status: ProviderStatus;
  kind?: LlmBillingKind | null;
  detail?: string | null;
  notified: boolean;
  source: "probe" | "detector";
};

export type ProbeResult = {
  provider: LlmProvider;
  status: ProviderStatus;
  kind?: LlmBillingKind | null;
  detail?: string | null;
};

const PROVIDER_LABEL: Record<LlmProvider, string> = { openai: "OpenAI", gemini: "Gemini" };
const FIX_URL: Record<LlmProvider, string> = {
  openai: "https://platform.openai.com/settings/organization/billing/overview",
  gemini: "https://aistudio.google.com/spend",
};
const KIND_LABEL: Record<LlmBillingKind, string> = {
  credit_exhausted: "se agotó el crédito",
  spend_cap: "llegó al tope mensual de gasto",
  payment_required: "falta saldo o un pago pendiente",
};

async function latestStatus(
  admin: ReturnType<typeof createAdminClient>,
  provider: LlmProvider,
): Promise<{ row: StatusRow; createdAt: string } | null> {
  const { data } = await admin
    .from("system_metrics")
    .select("data, created_at")
    .eq("event", EVENT)
    .eq("data->>provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { row: data.data as StatusRow, createdAt: data.created_at as string } : null;
}

async function saveStatus(admin: ReturnType<typeof createAdminClient>, row: StatusRow): Promise<void> {
  const { error } = await admin.from("system_metrics").insert({ event: EVENT, data: row });
  if (error) console.error("[llm-health] no se pudo guardar el estado:", error.message);
}

async function sendAlert(subject: string, lines: string[]): Promise<boolean> {
  const to = process.env.LLM_ALERT_EMAIL || "info@glor-ia.com";
  const fullSubject = `${process.env.LLM_ALERT_SUBJECT_TAG || ""}${subject}`;
  console.warn(`[llm-health] alerta: ${fullSubject}`);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[llm-health] RESEND_API_KEY no configurada; la alerta no salió por correo.");
    return false;
  }
  try {
    const resend = new (await import("resend")).Resend(key);
    const html = `<div style="font-family:sans-serif;max-width:560px;color:#1A1A1A;">
      <h2 style="color:#4A55A2;">${subject}</h2>
      ${lines.map((l) => `<p style="line-height:1.5;">${l}</p>`).join("")}
    </div>`;
    const { error } = await resend.emails.send({ from: "GlorIA <noreply@glor-ia.com>", to, subject: fullSubject, html });
    await logEmail("llm_alert", to, !error);
    if (error) console.error("[llm-health] Resend rechazó la alerta:", error.message);
    return !error;
  } catch (err) {
    await logEmail("llm_alert", to, false);
    console.error("[llm-health] no se pudo enviar la alerta:", err instanceof Error ? err.message : err);
    return false;
  }
}

function billingAlert(provider: LlmProvider, kind: LlmBillingKind | null | undefined, otherDown: boolean | null) {
  const name = PROVIDER_LABEL[provider];
  const why = kind ? KIND_LABEL[kind] : "falta saldo";
  const subject = otherDown
    ? `URGENTE: GlorIA sin LLM. ${name}: ${why}`
    : `${name} sin servicio: ${why}`;
  const consequence = otherDown
    ? "<strong>Ambos proveedores están caídos: los pacientes no responden.</strong> Los estudiantes ven el aviso de sesión en pausa."
    : otherDown === false
      ? "El otro proveedor está respondiendo y atiende todo por ahora, pero queda sin respaldo y puede subir el gasto."
      : "Detectado en una llamada real. La sonda confirmará en su próxima corrida si el otro proveedor sigue respondiendo.";
  return {
    subject,
    lines: [consequence, `Qué hacer: <a href="${FIX_URL[provider]}">revisar la facturación de ${name}</a>.`],
  };
}

/** Procesa una corrida de la sonda: guarda los cambios y avisa de los que importan. */
export async function processProbeResults(results: ProbeResult[]): Promise<string[]> {
  const admin = createAdminClient();
  const actions: string[] = [];

  for (const r of results) {
    const other = results.find((o) => o.provider !== r.provider);
    const otherDown = other ? other.status !== "ok" : null;
    const prev = await latestStatus(admin, r.provider);
    const prevRow = prev?.row;
    const base = { provider: r.provider, kind: r.kind ?? null, detail: r.detail ?? null, source: "probe" as const };

    if (r.status === "ok") {
      if (prevRow && prevRow.status !== "ok") {
        if (prevRow.notified) {
          await sendAlert(`${PROVIDER_LABEL[r.provider]} volvió a responder`, [
            "La sonda confirmó que el proveedor responde de nuevo.",
          ]);
          actions.push(`${r.provider}: recuperado`);
        }
        await saveStatus(admin, { ...base, status: "ok", notified: false });
      }
      continue;
    }

    if (r.status === "billing") {
      const stale = prev ? Date.now() - new Date(prev.createdAt).getTime() >= REMINDER_MS : true;
      if (prevRow?.status === "billing" && prevRow.notified && !stale) continue;
      const { subject, lines } = billingAlert(r.provider, r.kind, otherDown);
      const notified = await sendAlert(subject, lines);
      await saveStatus(admin, { ...base, status: "billing", notified });
      actions.push(`${r.provider}: alerta de saldo`);
      continue;
    }

    // Fallo pasajero (timeout, 503): solo avisa si se repite en dos corridas seguidas.
    if (prevRow?.status === "billing") continue;
    if (prevRow?.status === "error") {
      if (prevRow.notified) continue;
      const notified = await sendAlert(`${PROVIDER_LABEL[r.provider]} falla en dos pruebas seguidas`, [
        `Último error: ${r.detail ?? "desconocido"}`,
        otherDown ? "<strong>El otro proveedor tampoco responde.</strong>" : "El otro proveedor está respondiendo.",
      ]);
      await saveStatus(admin, { ...base, status: "error", notified });
      actions.push(`${r.provider}: alerta de error repetido`);
    } else {
      await saveStatus(admin, { ...base, status: "error", notified: false });
      actions.push(`${r.provider}: primer error, sin aviso`);
    }
  }
  return actions;
}

const lastDetectorRun = new Map<LlmProvider, number>();

/**
 * Detector: una llamada real falló por saldo. Nunca lanza: una alarma rota no
 * puede empeorarle la respuesta a un estudiante.
 */
export async function reportBillingFailure(provider: LlmProvider, kind: LlmBillingKind): Promise<void> {
  try {
    const now = Date.now();
    if (now - (lastDetectorRun.get(provider) ?? 0) < DETECTOR_COOLDOWN_MS) return;
    lastDetectorRun.set(provider, now);

    const admin = createAdminClient();
    const prev = await latestStatus(admin, provider);
    if (prev?.row.status === "billing" && prev.row.notified) return;

    const { subject, lines } = billingAlert(provider, kind, null);
    const notified = await sendAlert(subject, lines);
    await saveStatus(admin, { provider, status: "billing", kind, detail: null, notified, source: "detector" });
  } catch (err) {
    console.error("[llm-health] detector falló:", err instanceof Error ? err.message : err);
  }
}
