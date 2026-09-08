import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { getAppUrl } from "@/lib/app-url";

/**
 * Disparo manual del informe semanal desde el panel.
 *
 * No reimplementa nada: llama al mismo cron con force=1 (y dry=1 para la
 * vista previa), autenticándose con CRON_SECRET. Tener dos caminos que arman
 * el informe sería tener dos caminos que se van separando.
 *
 * force=1 salta la guarda de las 7:00, pero NO la idempotencia: report_runs
 * tiene índice único por (institución, semana), así que apretar el botón un
 * lunes después de que ya salió no manda nada dos veces.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const perfil = await getUserProfile();
  if (perfil?.realRole !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });

  const { dry } = await request.json().catch(() => ({ dry: true }));

  const url = `${getAppUrl()}/api/cron/informe-semanal?force=1${dry ? "&dry=1" : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ error: body?.error || `Error ${res.status}` }, { status: res.status });
  }
  return NextResponse.json(body);
}
