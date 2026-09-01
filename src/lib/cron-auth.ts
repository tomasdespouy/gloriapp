/**
 * Autenticación de rutas de cron.
 *
 * El mismo bloque de cinco líneas estaba copiado en cuatro rutas bajo
 * /api/cron y en tres rutas mixtas que aceptan cron o superadmin. Consolidarlo
 * importa más de lo que parece: si mañana se rota CRON_SECRET o se agrega un
 * segundo secreto de transición, hoy habría que acordarse de siete archivos.
 *
 * El middleware deja pasar /api/cron/ sin sesión (src/lib/supabase/middleware.ts),
 * así que este chequeo es la única puerta.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Devuelve una respuesta 401/500 si la petición NO viene del cron, o `null`
 * si está autorizada. El patrón de uso es:
 *
 *   const rejected = requireCron(request);
 *   if (rejected) return rejected;
 */
export function requireCron(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET no está configurada");
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

/**
 * Variante para las rutas que se disparan por cron **o** a mano desde el panel:
 * acepta el Bearer del cron, y si no viene, exige una sesión de superadmin.
 *
 * Es asíncrona porque leer el rol requiere ir a la base; las rutas que solo
 * aceptan cron deben usar `requireCron`, que es síncrona.
 */
export async function requireCronOrSuperadmin(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}
