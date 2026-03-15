import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage() {
  const ctx = await getAdminContext();
  const supabase = await createClient();

  // Fetch users scoped by establishment
  const usersQuery = supabase
    .from("profiles")
    .select("id, email, full_name, role, establishment_id, course_id, section_id, is_disabled, created_at")
    .order("full_name");

  const { data: users } = ctx.isSuperadmin
    ? await usersQuery
    : await usersQuery.in(
        "establishment_id",
        ctx.establishmentIds.length > 0
          ? ctx.establishmentIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

  // Fetch establishments for filter dropdown
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name").order("name")
    : await supabase
        .from("establishments")
        .select("id, name")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name");

  // Fetch courses and sections for display names
  const { data: allCourses } = await supabase.from("courses").select("id, name");
  const { data: allSections } = await supabase.from("sections").select("id, name");
  const courseMap = new Map((allCourses || []).map((c) => [c.id, c.name]));
  const sectionMap = new Map((allSections || []).map((s) => [s.id, s.name]));

  // Session counts per student
  const studentIds = users?.filter((u) => u.role === "student").map((u) => u.id) || [];
  const safeIds = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: sessions } = await supabase
    .from("conversations")
    .select("student_id, created_at")
    .eq("status", "completed")
    .in("student_id", safeIds);

  const sessionCountMap: Record<string, number> = {};
  const lastActivityMap: Record<string, string> = {};
  sessions?.forEach((s) => {
    sessionCountMap[s.student_id] = (sessionCountMap[s.student_id] || 0) + 1;
    if (!lastActivityMap[s.student_id] || s.created_at > lastActivityMap[s.student_id]) {
      lastActivityMap[s.student_id] = s.created_at;
    }
  });

  const enrichedUsers = (users || []).map((u) => ({
    ...u,
    sessionCount: sessionCountMap[u.id] || 0,
    lastActivity: lastActivityMap[u.id] || null,
    establishmentName: establishments?.find((e) => e.id === u.establishment_id)?.name || "—",
    courseName: u.course_id ? courseMap.get(u.course_id) || "—" : "—",
    sectionName: u.section_id ? sectionMap.get(u.section_id) || "—" : "—",
  }));

  return (
    <UsuariosClient
      users={enrichedUsers}
      establishments={establishments || []}
      isSuperadmin={ctx.isSuperadmin}
    />
  );
}
