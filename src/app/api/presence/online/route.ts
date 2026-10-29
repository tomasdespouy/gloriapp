import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesScope, resolveAdminScopeRules, type Scope } from "@/lib/admin-scope";

// Personas conectadas ahora, para el indicador flotante del layout.
//
// "Conectado" = last_seen_at en los últimos 2 minutos: PlatformActivityTracker
// avisa cada 60 s mientras la pestaña está visible (misma ventana que el
// monitor de Personas, src/app/api/monitor/roster/route.ts).
//
// El alcance sale del rol REAL guardado en profiles, no del rol que se está
// suplantando: superadmin ve a todos; admin, solo a los estudiantes y docentes
// de sus reglas de admin_establishments.

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = me?.role as string | undefined;
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const scope: Scope = role === "superadmin"
    ? { all: true }
    : { all: false, rules: await resolveAdminScopeRules(admin, user.id) };

  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  let q = admin
    .from("profiles")
    .select("id, full_name, email, role, establishment_id, course_id, section_id, last_seen_at")
    .gte("last_seen_at", cutoff)
    .neq("id", user.id)
    .order("last_seen_at", { ascending: false });
  if (role === "admin") q = q.in("role", ["student", "instructor"]);
  const { data: rows } = await q;
  const people = (rows || []).filter((p) => matchesScope(scope, p));

  const ids = people.map((p) => p.id);
  const estIds = [...new Set(people.map((p) => p.establishment_id).filter((x): x is string => !!x))];
  const courseIds = [...new Set(people.map((p) => p.course_id).filter((x): x is string => !!x))];
  const [{ data: active }, { data: ests }, { data: courses }] = await Promise.all([
    ids.length
      ? admin.from("conversations").select("student_id, ai_patients(name)").eq("status", "active").in("student_id", ids)
      : Promise.resolve({ data: [] as { student_id: string; ai_patients: unknown }[] }),
    estIds.length ? admin.from("establishments").select("id, name").in("id", estIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    courseIds.length ? admin.from("courses").select("id, name").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const inSession = new Map<string, string>();
  for (const c of active || []) {
    const patient = (c.ai_patients as { name?: string } | null)?.name;
    inSession.set(c.student_id, patient || "paciente");
  }
  const estName = new Map((ests || []).map((e) => [e.id, e.name]));
  const courseName = new Map((courses || []).map((c) => [c.id, c.name]));

  const online = people.map((p) => ({
    id: p.id,
    name: p.full_name || p.email?.split("@")[0] || "Usuario",
    role: p.role as string,
    inSessionWith: inSession.get(p.id) ?? null,
    // Superadmin necesita saber de qué institución es; un admin ya lo sabe y le
    // sirve más la asignatura.
    detail: role === "superadmin"
      ? estName.get(p.establishment_id ?? "") ?? null
      : courseName.get(p.course_id ?? "") ?? estName.get(p.establishment_id ?? "") ?? null,
  }));

  return NextResponse.json({ online, generatedAt: new Date().toISOString() });
}
