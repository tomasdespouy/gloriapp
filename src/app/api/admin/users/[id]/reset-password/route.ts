import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { matchesScope, resolveAdminScopeRules } from "@/lib/admin-scope";
import { issueCredentials } from "@/lib/credentials/issue";

/**
 * Entrega inmediata de credenciales a UNA persona.
 *
 * Toda la mecánica (clave temporal, rotación, plantilla, envío, email_log,
 * credentials_sent_at, auditoría) vive en src/lib/credentials/issue.ts, que
 * comparte con el worker programado. Acá solo queda lo que es propio de una
 * petición autenticada: quién llama, sobre quién, y si tiene alcance.
 *
 * El contrato de respuesta {success, emailSent, emailError} NO cambió: la UI
 * de /admin/usuarios lo lee tal cual.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role, full_name, email, establishment_id, course_id, section_id, credentials_sent_at")
    .eq("id", id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (target.role === "superadmin") {
    return NextResponse.json({ error: "No se puede restablecer la contraseña de un superadmin" }, { status: 403 });
  }

  // Los admin solo emiten credenciales para estudiantes/docentes de sus propios
  // establecimientos. Los superadmin conservan acceso total (menos a otros
  // superadmin, bloqueados arriba).
  if (callerRole === "admin") {
    if (target.role !== "student" && target.role !== "instructor") {
      return NextResponse.json({ error: "Sin permisos para este rol" }, { status: 403 });
    }
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!matchesScope({ all: false, rules }, target)) {
      return NextResponse.json({ error: "Usuario fuera de tu alcance" }, { status: 403 });
    }
  }

  const result = await issueCredentials(admin, {
    userId: id,
    actorId: user.id,
    via: "manual",
  });

  // Un fallo al rotar la contraseña es un 500: no se llegó a intentar el correo.
  if (!result.emailSent && result.errorCode === "rotate_failed") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    emailSent: result.emailSent,
    emailError: result.error,
  });
}
