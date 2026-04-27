/**
 * MANUAL POLL — fuerza el procesamiento del cron de polling para uso desde supradmin.
 * GET: invoca la misma logica que /api/cron/research/poll pero con auth superadmin.
 * Util para no esperar al schedule cuando se gatillo un scan manual.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  }

  // Reusa la misma URL del cron de polling (mismo deploy) con bearer interno.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;

  const res = await fetch(`${baseUrl}/api/cron/research/poll`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
