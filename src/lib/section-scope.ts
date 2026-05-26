import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/supabase/user-profile";

/**
 * Section-level scoping for the docente surfaces.
 *
 * GlorIA's model: an instructor is assigned to a section (profiles.section_id)
 * or, more broadly, a course/asignatura (profiles.course_id). They should only
 * see/act on the students of THAT section. Admins and superadmins see the whole
 * establishment. Instructors with no section/course assigned fall back to the
 * establishment-wide view (backward compatible — no one loses access).
 *
 * This complements establishment scoping (RLS + page guards), narrowing it one
 * level further to the section.
 */
export type DocenteScope = {
  userId: string;
  role: string;
  fullName: string;
  establishmentId: string | null;
  sectionId: string | null;
  courseId: string | null;
};

/**
 * Resolve the current caller's docente scope. Impersonation-aware: a superadmin
 * impersonating an instructor is scoped to the impersonated establishment (but
 * not to a section, since the impersonated identity carries none → falls back
 * to establishment-wide, same as before).
 */
export async function getDocenteScope(): Promise<DocenteScope | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const userProfile = await getUserProfile();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, establishment_id, section_id, course_id")
    .eq("id", user.id)
    .single();

  const role = (userProfile?.role || profile?.role || "instructor") as string;
  const establishmentId = userProfile?.establishmentId ?? profile?.establishment_id ?? null;
  // Section/course only narrow instructors acting on their own profile.
  const isInstructor = role === "instructor";

  return {
    userId: user.id,
    role,
    fullName: profile?.full_name || "Docente",
    establishmentId,
    sectionId: isInstructor ? (profile?.section_id ?? null) : null,
    courseId: isInstructor ? (profile?.course_id ?? null) : null,
  };
}

/**
 * Can the holder of `scope` see a student with the given section/course?
 * Used for single-resource access checks and for filtering notification
 * recipients.
 */
export function canViewStudent(
  scope: Pick<DocenteScope, "role" | "sectionId" | "courseId">,
  student: { section_id?: string | null; course_id?: string | null },
): boolean {
  if (scope.role === "admin" || scope.role === "superadmin") return true;
  // Unscoped instructor → establishment-wide (backward compatible).
  if (!scope.sectionId && !scope.courseId) return true;
  if (scope.sectionId) return !!student.section_id && student.section_id === scope.sectionId;
  return !!student.course_id && student.course_id === scope.courseId;
}

/**
 * The student IDs visible to `scope`: establishment-scoped, then narrowed by
 * the instructor's section (or course). Returns [] when the establishment has
 * no matching students (callers should treat [] as "no students").
 */
export async function getScopedStudentIds(scope: DocenteScope): Promise<string[]> {
  const admin = createAdminClient();
  let q = admin.from("profiles").select("id").eq("role", "student");
  if (scope.establishmentId) q = q.eq("establishment_id", scope.establishmentId);
  if (scope.sectionId) q = q.eq("section_id", scope.sectionId);
  else if (scope.courseId) q = q.eq("course_id", scope.courseId);
  const { data } = await q;
  return (data || []).map((s) => s.id);
}
