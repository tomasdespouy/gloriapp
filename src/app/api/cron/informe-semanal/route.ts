import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCron } from "@/lib/cron-auth";
import { buildWeeklyReportData } from "@/lib/reports/weekly-report-data";
import { buildWeeklyReportDocx, weeklyReportFilename } from "@/lib/reports/weekly-report-docx";
import { unstable_noStore as noStore } from "next/cache";

/**
 * CRON: informe semanal de uso, los lunes a las 7:00 de Chile.
 *
 * Por qué el cron está declarado DOS veces en vercel.json (10:00 y 11:00 UTC):
 * Vercel solo programa en UTC, y Chile cambia de huso dos veces al año — las
 * 7:00 de Santiago son las 11:00 UTC en invierno y las 10:00 UTC en verano. Un
 * cron fijo llegaría una hora corrido medio año. Se disparan los dos y esta
 * función pregunta qué hora es REALMENTE en Santiago; la corrida que no
 * corresponde sale sin hacer nada.
 *
 * La idempotencia real no la da el horario sino report_runs, que tiene índice
 * único por (establecimiento, semana). Aunque las dos corridas coincidieran, o
 * alguien apretara el botón manual, solo una llega a enviar.
 *
 * ?dry=1  → genera el informe y responde el resumen sin mandar ni escribir.
 * ?force=1 → salta la guarda de las 7:00 (para el envío manual desde el panel).
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const TZ = "America/Santiago";
const HORA_ENVIO = 7;

/** Hora local en Santiago, sin depender de la zona del servidor. */
function horaEnSantiago(d = new Date()): { hora: number; dia: number; clave: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, hour: "2-digit", hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => partes.find((p) => p.type === t)?.value || "";
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hora: Number(g("hour")), dia: dias[g("weekday")] ?? -1, clave: `${g("year")}-${g("month")}-${g("day")}` };
}

/**
 * Semana ISO ("2026-W37"). Es la clave de idempotencia: todo lo que se mande
 * dentro de la misma semana cuenta como el mismo envío.
 */
function semanaISO(d = new Date()): string {
  const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + 4 - dow);
  const inicio = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((f.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return `${f.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  noStore();
  const rejected = requireCron(request);
  if (rejected) return rejected;

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const ahora = horaEnSantiago();
  if (!force && ahora.hora !== HORA_ENVIO) {
    return NextResponse.json({
      enviados: 0,
      message: `No corresponde: en Santiago son las ${ahora.hora}:00 y el envío es a las ${HORA_ENVIO}:00.`,
    });
  }

  const admin = createAdminClient();
  const periodo = semanaISO();

  // Instituciones con al menos un suscriptor activo.
  const { data: subs, error: errSubs } = await admin
    .from("report_subscriptions")
    .select("establishment_id, email, full_name")
    .eq("is_active", true);
  if (errSubs) return NextResponse.json({ error: errSubs.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ enviados: 0, message: "Sin suscriptores activos" });

  const porEst = new Map<string, { email: string; full_name: string | null }[]>();
  for (const s of subs) {
    if (!porEst.has(s.establishment_id)) porEst.set(s.establishment_id, []);
    porEst.get(s.establishment_id)!.push({ email: s.email, full_name: s.full_name });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey && !dry) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  }

  const resumen: Record<string, unknown>[] = [];

  for (const [establishmentId, destinatarios] of porEst) {
    // El índice único por (establecimiento, semana) es lo que impide el envío
    // doble. Si la fila ya existe, esta semana ya se despachó.
    let runId: string | null = null;
    if (!dry) {
      const { data: run, error } = await admin
        .from("report_runs")
        .insert({
          establishment_id: establishmentId,
          period_key: periodo,
          recipients: destinatarios.length,
          triggered_by: force ? "manual" : "cron",
        })
        .select("id")
        .single();
      if (error) {
        resumen.push({ establishmentId, saltado: true, motivo: "ya se envió esta semana" });
        continue;
      }
      runId = run.id;
    }

    try {
      const datos = await buildWeeklyReportData(admin, establishmentId);
      const buffer = await buildWeeklyReportDocx(datos);
      const filename = weeklyReportFilename(datos);

      if (dry) {
        resumen.push({
          establecimiento: datos.establecimiento, destinatarios: destinatarios.length,
          titular: datos.titular.texto, kb: Math.round(buffer.length / 1024), filename,
        });
        continue;
      }

      const adjunto = buffer.toString("base64");
      let ok = 0, mal = 0;

      for (const dest of destinatarios) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
              // Una sola vez por persona y semana, aunque algo se reintente.
              "Idempotency-Key": `informe-${establishmentId}-${periodo}-${dest.email}`,
            },
            body: JSON.stringify({
              from: "GlorIA <noreply@glor-ia.com>",
              to: dest.email,
              subject: `GlorIA — Informe semanal de ${datos.establecimiento}`,
              html: cuerpoCorreo(datos.establecimiento, datos.titular.texto, datos.totales.sesionesUltimos7),
              attachments: [{ filename, content: adjunto }],
            }),
          });
          if (!res.ok) {
            mal++;
            const detalle = (await res.text()).slice(0, 300);
            await admin.from("report_deliveries").insert({
              run_id: runId, email: dest.email, success: false, error: `${res.status} ${detalle}`,
            });
            continue;
          }
          const body = await res.json().catch(() => null);
          await admin.from("report_deliveries").insert({
            run_id: runId, email: dest.email, success: true, provider_message_id: body?.id ?? null,
          });
          ok++;
        } catch (e) {
          mal++;
          await admin.from("report_deliveries").insert({
            run_id: runId, email: dest.email, success: false,
            error: e instanceof Error ? e.message.slice(0, 300) : "error desconocido",
          });
        }
        // Resend admite 10 por segundo; este respiro sobra y no cuesta nada.
        await new Promise((r) => setTimeout(r, 120));
      }

      await admin.from("report_runs").update({
        status: ok > 0 ? "sent" : "failed",
        sent_count: ok, failed_count: mal,
        snapshot: datos,
        finished_at: new Date().toISOString(),
      }).eq("id", runId);

      resumen.push({ establecimiento: datos.establecimiento, enviados: ok, fallidos: mal });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error desconocido";
      if (runId) {
        await admin.from("report_runs").update({
          status: "failed", note: msg.slice(0, 500), finished_at: new Date().toISOString(),
        }).eq("id", runId);
      }
      resumen.push({ establishmentId, error: msg });
    }
  }

  return NextResponse.json({ periodo, dry, resumen });
}

function cuerpoCorreo(institucion: string, titular: string, sesionesSemana: number): string {
  return `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <div style="background: #4A55A2; padding: 22px 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Informe semanal · ${institucion}</h1>
        <p style="color: rgba(255,255,255,0.82); margin: 6px 0 0; font-size: 13px;">
          Uso de GlorIA — ${sesionesSemana} sesiones nuevas esta semana
        </p>
      </div>
      <div style="background: #FAFAFA; padding: 28px 30px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 18px;">
          Adjuntamos el informe de esta semana en Word. Lo más accionable:
        </p>
        <div style="background: #F0F2FA; border-left: 4px solid #4A55A2; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 0 0 20px;">
          <p style="font-size: 14px; color: #1A1A1A; margin: 0; font-weight: 600; line-height: 1.5;">${titular}</p>
        </div>
        <p style="font-size: 13px; color: #777; line-height: 1.6; margin: 0;">
          El documento adjunto trae el detalle por sección, el perfil de competencias de la
          cohorte y el estado del ciclo de devolución.
        </p>
        <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          <p style="font-size: 13px; color: #333; margin: 0; font-weight: 700;">Equipo GlorIA</p>
          <p style="font-size: 12px; color: #999; margin: 4px 0 0;">
            ¿Dudas sobre estas cifras? Escríbenos a info@glor-ia.com
          </p>
        </div>
      </div>
    </div>
  `;
}
