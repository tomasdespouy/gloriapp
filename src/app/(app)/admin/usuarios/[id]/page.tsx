import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User } from "lucide-react";
import UserDetailClient from "./UserDetailClient";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminContext();
  const supabase = await createClient();

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, establishment_id, course_id, section_id, created_at")
    .eq("id", id)
    .single();

  if (!userProfile) redirect("/admin/usuarios");

  // Verify access for non-superadmin
  if (!ctx.isSuperadmin && userProfile.establishment_id && !ctx.establishmentIds.includes(userProfile.establishment_id)) {
    redirect("/admin/usuarios");
  }

  // Fetch establishments for dropdown
  const { data: establishments } = ctx.isSuperadmin
    ? await supabase.from("establishments").select("id, name").order("name")
    : await supabase
        .from("establishments")
        .select("id, name")
        .in("id", ctx.establishmentIds.length > 0 ? ctx.establishmentIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name");

  // Session stats
  const { data: sessions } = await supabase
    .from("conversations")
    .select("id, created_at, status, session_competencies(overall_score)")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  type CompRow = { overall_score: number };
  const completedSessions = sessions?.filter((s) => s.status === "completed") || [];
  const scores = completedSessions.flatMap((s) => {
    const comp = (s.session_competencies as CompRow[] | null)?.[0];
    return comp?.overall_score != null ? [Number(comp.overall_score)] : [];
  });
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : "—";

  const currentEstName = establishments?.find((e) => e.id === userProfile.establishment_id)?.name || "Sin asignar";

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/usuarios" className="hover:text-sidebar transition-colors">
            Usuarios
          </Link>
          <span>/</span>
          <span className="text-gray-700">{userProfile.full_name || userProfile.email}</span>
        </div>
        <div className="flex items-center gap-3">
          <User size={24} className="text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">{userProfile.full_name || userProfile.email}</h1>
        </div>
      </header>

      <div className="px-8 pb-8 space-y-6">
        {/* Info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="text-sm font-medium text-gray-900">{userProfile.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Rol</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{userProfile.role}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Establecimiento</dt>
              <dd className="text-sm font-medium text-gray-900">{currentEstName}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Registrado</dt>
              <dd className="text-sm text-gray-900">
                {new Date(userProfile.created_at).toLocaleDateString("es-CL")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Sesiones completadas</dt>
              <dd className="text-sm font-medium text-gray-900">{completedSessions.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Puntaje promedio</dt>
              <dd className="text-sm font-medium text-gray-900">{avgScore}</dd>
            </div>
          </dl>
        </div>

        {/* Edit role/establishment (superadmin only) */}
        {ctx.isSuperadmin && (
          <UserDetailClient
            userId={userProfile.id}
            currentRole={userProfile.role}
            currentEstablishmentId={userProfile.establishment_id}
            currentCourseId={userProfile.course_id}
            currentSectionId={userProfile.section_id}
            establishments={establishments || []}
          />
        )}
      </div>
    </div>
  );
}
