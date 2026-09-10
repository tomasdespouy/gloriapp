/**
 * Envía un .docx ya revisado a la lista de distribución de una institución.
 *
 * Existe además del cron semanal porque son cosas distintas: el cron genera y
 * manda sin que nadie mire; esto manda un documento que YA se revisó. Cuando el
 * informe lleva secciones escritas a mano —los casos comentados, el anexo de la
 * rúbrica— el que vale es este.
 *
 * Deja el registro en report_runs y report_deliveries, igual que el cron, para
 * que el panel de superadmin muestre el envío junto a los demás y no queden
 * dos historias separadas de "qué se le mandó a quién".
 *
 * Uso:
 *   node scripts/enviar-informe-manual.mjs --est <uuid> --archivo <ruta>
 *   node scripts/enviar-informe-manual.mjs --est <uuid> --archivo <ruta> --enviar
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const EST = flag("--est");
const ARCHIVO = flag("--archivo");
const ENVIAR = args.includes("--enviar");
const TITULAR = flag("--titular");
// Reenvío deliberado de la misma semana: agrega un sufijo a la clave de período
// para no chocar con el índice único, y queda registrado como corrida aparte.
// Sin esto habría que borrar la corrida anterior, y se perdería el rastro de
// que se mandó dos veces.
const REENVIO = args.includes("--reenvio");

if (!EST || !ARCHIVO) {
  console.error("Uso: --est <uuid> --archivo <ruta> [--titular \"...\"] [--enviar]");
  process.exit(1);
}

const ROOT = path.join(import.meta.dirname, "..");
const cfg = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function claveResend() {
  if (cfg.RESEND_API_KEY) return cfg.RESEND_API_KEY;
  const local = path.join(ROOT, ".env.local");
  if (fs.existsSync(local)) {
    const l = dotenv.parse(fs.readFileSync(local, "utf8").replace(/^﻿/, ""));
    if (l.RESEND_API_KEY) return l.RESEND_API_KEY;
  }
  console.error("No hay RESEND_API_KEY");
  process.exit(1);
}
const RESEND = claveResend();
const APP = "https://www.glor-ia.com";

/** Semana ISO: misma clave de idempotencia que usa el cron. */
function semanaISO(d = new Date()) {
  const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + 4 - dow);
  const inicio = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
  return `${f.getUTCFullYear()}-W${String(Math.ceil(((f - inicio) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}

const { data: est } = await s.from("establishments").select("name").eq("id", EST).maybeSingle();
if (!est) { console.error("Institución no encontrada"); process.exit(1); }

const { data: subs } = await s.from("report_subscriptions")
  .select("email, full_name").eq("establishment_id", EST).eq("is_active", true).order("email");

const buf = fs.readFileSync(ARCHIVO);
const nombreArchivo = path.basename(ARCHIVO);

console.log(`\nInstitución : ${est.name}`);
console.log(`Adjunto     : ${nombreArchivo} (${Math.round(buf.length / 1024)} KB)`);
console.log(`Semana      : ${semanaISO()}`);
console.log(`Destinatarios (${subs?.length || 0}):`);
for (const d of subs || []) console.log(`   ${d.email}${d.full_name ? ` — ${d.full_name}` : ""}`);

if (!subs?.length) { console.log("\nSin suscriptores activos: no hay a quién enviar."); process.exit(0); }
if (!ENVIAR) { console.log("\nModo lista. Para enviar de verdad: agrega --enviar"); process.exit(0); }

const titular = TITULAR || "Informe de uso de la semana.";

const html = `
  <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
    <div style="background: #4A55A2; padding: 22px 30px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 20px;">Informe de uso · ${est.name}</h1>
      <p style="color: rgba(255,255,255,0.82); margin: 6px 0 0; font-size: 13px;">
        Psicopatología del Adulto · 2026-20
      </p>
    </div>
    <div style="background: #FAFAFA; padding: 28px 30px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
      <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 18px;">
        Adjuntamos el informe de uso de GlorIA en Word. Lo más accionable:
      </p>
      <div style="background: #F0F2FA; border-left: 4px solid #4A55A2; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 0 0 20px;">
        <p style="font-size: 14px; color: #1A1A1A; margin: 0; font-weight: 600; line-height: 1.5;">${titular}</p>
      </div>
      <p style="font-size: 13px; color: #777; line-height: 1.6; margin: 0;">
        El documento trae la participación por sección, el ritmo por número de sesión, el perfil de
        competencias de la cohorte, la comparación entre la primera y la segunda entrevista con casos
        comentados, y un anexo con las diez competencias y la rúbrica completa con la que se evalúa.
      </p>
      <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
        <p style="font-size: 13px; color: #333; margin: 0; font-weight: 700;">Equipo GlorIA</p>
        <p style="font-size: 12px; color: #999; margin: 4px 0 0;">
          ¿Dudas sobre estas cifras? Escríbenos a info@glor-ia.com · ${APP}
        </p>
      </div>
    </div>
  </div>`;

// Registro de la corrida, igual que el cron.
const { data: run, error: errRun } = await s.from("report_runs").insert({
  establishment_id: EST,
  period_key: REENVIO ? `${semanaISO()}-r${Date.now().toString(36).slice(-4)}` : semanaISO(),
  recipients: subs.length,
  triggered_by: REENVIO ? "reenvío" : "manual",
  note: `Documento revisado a mano: ${nombreArchivo}`,
}).select("id").single();

if (errRun) {
  console.error("\nNo se pudo registrar la corrida:", errRun.message);
  console.error("Probablemente ya se envió el informe de esta semana. No se manda nada.");
  process.exit(1);
}

const adjunto = buf.toString("base64");
let ok = 0, mal = 0;

for (const d of subs) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `informe-manual-${EST}-${run.id}-${d.email}`,
      },
      body: JSON.stringify({
        from: "GlorIA <noreply@glor-ia.com>",
        to: d.email,
        subject: `GlorIA — Informe de uso de ${est.name}`,
        html,
        attachments: [{ filename: nombreArchivo, content: adjunto }],
      }),
    });
    if (!res.ok) {
      mal++;
      const detalle = (await res.text()).slice(0, 300);
      await s.from("report_deliveries").insert({ run_id: run.id, email: d.email, success: false, error: `${res.status} ${detalle}` });
      console.log(`   ✗ ${d.email} — ${detalle.slice(0, 90)}`);
      continue;
    }
    const body = await res.json().catch(() => null);
    await s.from("report_deliveries").insert({ run_id: run.id, email: d.email, success: true, provider_message_id: body?.id ?? null });
    ok++;
    console.log(`   ✓ ${d.email}`);
  } catch (e) {
    mal++;
    await s.from("report_deliveries").insert({ run_id: run.id, email: d.email, success: false, error: String(e).slice(0, 300) });
    console.log(`   ✗ ${d.email} — ${String(e).slice(0, 90)}`);
  }
  await new Promise((r) => setTimeout(r, 150));
}

await s.from("report_runs").update({
  status: ok > 0 ? "sent" : "failed",
  sent_count: ok, failed_count: mal,
  finished_at: new Date().toISOString(),
}).eq("id", run.id);

console.log(`\nEnviados ${ok}, fallidos ${mal}.`);
console.log("Queda registrado en el panel: Informe semanal → Envíos.");
