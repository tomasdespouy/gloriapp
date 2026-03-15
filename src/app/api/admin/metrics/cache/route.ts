import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { patientCache, stateCache, profileCache, generalCache } from "@/lib/cache";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  return NextResponse.json({
    patients: patientCache.stats(),
    states: stateCache.stats(),
    profiles: profileCache.stats(),
    general: generalCache.stats(),
  });
}
