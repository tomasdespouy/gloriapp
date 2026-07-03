import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canViewStudent } from "@/lib/section-scope";
import { matchesScope, resolveAdminScopeRules } from "@/lib/admin-scope";

export type FeedbackAuthResult =
  | { ok: true; userId: string; role: string; studentId: string }
  | { ok: false; status: number; error: string };

/**
 * Authorizes an instructor/admin/superadmin to act on the feedback flow of a
 * given session, scoped by establishment AND section. Mirrors the check in
 * /docente/sesion/[conversationId]/page.tsx: instructors may only touch
 * sessions of students in their OWN establishment and section/course
 * (instructors without a section see the whole establishment); admin and
 * superadmin bypass the scope.
 *
 * Why this lives here and not only in RLS: the mutating /api/docente routes
 * write with the service-role (admin) client, which bypasses RLS entirely.
 * The establishment RLS policies (20260525120000) only close the direct
 * PostgREST hole; they do nothing for the app's own admin-client writes. So
 * this helper is the only thing scoping those routes — call it before any
 * read or write that targets a specific student's session.
 *
 * Pass `conversationId` (the route resolves the student) or `studentId`
 * directly (used by listing endpoints that filter by student).
 */
export async function authorizeFeedbackAccess(opts: {
  conversationId?: string;
  studentId?: string;
}): Promise<FeedbackAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autenticado" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, establishment_id, section_id, course_id")
    .eq("id", user.id)
    .single();

  const role = caller?.role as string | undefined;
  if (role !== "instructor" && role !== "admin" && role !== "superadmin") {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  const admin = createAdminClient();

  // Resolve the student whose data is being touched.
  let studentId = opts.studentId ?? null;
  if (!studentId && opts.conversationId) {
    const { data: conversation } = await admin
      .from("conversations")
      .select("student_id")
      .eq("id", opts.conversationId)
      .single();
    if (!conversation) {
      return { ok: false, status: 404, error: "Conversación no encontrada" };
    }
    studentId = conversation.student_id;
  }

  if (!studentId) {
    return { ok: false, status: 400, error: "conversation_id o student_id requerido" };
  }

  // Instructor scope: the student must belong to the same establishment AND to
  // the instructor's section/course (instructors without a section see the
  // whole establishment — see canViewStudent). Instructors without an
  // establishment cannot act on any session.
  if (role === "instructor") {
    const { data: student } = await admin
      .from("profiles")
      .select("establishment_id, section_id, course_id")
      .eq("id", studentId)
      .single();

    const sameEstablishment =
      !!caller?.establishment_id &&
      !!student?.establishment_id &&
      caller.establishment_id === student.establishment_id;
    const inSection = canViewStudent(
      { role, sectionId: caller?.section_id ?? null, courseId: caller?.course_id ?? null },
      { section_id: student?.section_id, course_id: student?.course_id },
    );

    if (!sameEstablishment || !inSection) {
      return { ok: false, status: 403, error: "No autorizado" };
    }
  } else if (role === "admin") {
    // Admin acotado por asignatura/sección: solo puede actuar sobre alumnos de su alcance.
    const { data: student } = await admin
      .from("profiles")
      .select("establishment_id, section_id, course_id")
      .eq("id", studentId)
      .single();
    const rules = await resolveAdminScopeRules(admin, user.id);
    if (!matchesScope({ all: false, rules }, {
      establishment_id: student?.establishment_id,
      section_id: student?.section_id,
      course_id: student?.course_id,
    })) {
      return { ok: false, status: 403, error: "No autorizado" };
    }
  }

  return { ok: true, userId: user.id, role, studentId };
}
