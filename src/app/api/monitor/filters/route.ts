import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/supabase/user-profile";
import { getMonitorAuthority } from "@/lib/monitor/scope";

// Árbol Universidad → Asignatura → Sección para poblar el filtro en cascada
// del panel "Personas". Acotado a la autoridad del usuario: superadmin ve
// todo; admin sus establecimientos; instructor el suyo. El recorte real de
// alumnos lo sigue haciendo /api/monitor/roster (este endpoint solo arma las
// opciones del selector).

type SectionNode = { id: string; name: string };
type CourseNode = { id: string; name: string; code: string | null; sections: SectionNode[] };
type EstablishmentNode = { id: string; name: string; courses: CourseNode[] };

export async function GET() {
  const auth = await getMonitorAuthority();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  // Establecimientos en alcance: null = todos (superadmin).
  let estIds: string[] | null = null;
  if (auth.mode !== "all") {
    if (auth.establishmentIds.length > 0) {
      estIds = auth.establishmentIds;
    } else {
      // Instructor en modo sección/curso: deriva su establecimiento.
      const profile = await getUserProfile();
      estIds = profile?.establishmentId ? [profile.establishmentId] : [];
    }
    if (estIds.length === 0) {
      return NextResponse.json({ establishments: [] });
    }
  }

  const estQuery = admin.from("establishments").select("id, name").order("name");
  const { data: establishments } = estIds
    ? await estQuery.in("id", estIds)
    : await estQuery;

  const estList = establishments || [];
  if (estList.length === 0) return NextResponse.json({ establishments: [] });

  const estIdList = estList.map((e) => e.id);

  // Asignaturas y secciones de esos establecimientos.
  const { data: courses } = await admin
    .from("courses")
    .select("id, name, code, establishment_id")
    .in("establishment_id", estIdList)
    .order("name");
  const courseList = courses || [];
  const courseIdList = courseList.map((c) => c.id);

  const { data: sections } = courseIdList.length
    ? await admin.from("sections").select("id, name, course_id").in("course_id", courseIdList).order("name")
    : { data: [] as { id: string; name: string; course_id: string }[] };

  const sectionsByCourse = new Map<string, SectionNode[]>();
  for (const s of sections || []) {
    if (!sectionsByCourse.has(s.course_id)) sectionsByCourse.set(s.course_id, []);
    sectionsByCourse.get(s.course_id)!.push({ id: s.id, name: s.name });
  }

  const coursesByEst = new Map<string, CourseNode[]>();
  for (const c of courseList) {
    if (!coursesByEst.has(c.establishment_id)) coursesByEst.set(c.establishment_id, []);
    coursesByEst.get(c.establishment_id)!.push({
      id: c.id,
      name: c.name,
      code: c.code,
      sections: sectionsByCourse.get(c.id) || [],
    });
  }

  const tree: EstablishmentNode[] = estList.map((e) => ({
    id: e.id,
    name: e.name,
    courses: coursesByEst.get(e.id) || [],
  }));

  return NextResponse.json({ establishments: tree });
}
