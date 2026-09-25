import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { resolveAdminScopeRules, scopeAllowsEstablishmentWide } from "@/lib/admin-scope";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo admin/superadmin (usa service-role que bypassa RLS): sin gate, cualquier
  // usuario autenticado podía enumerar el catálogo de cualquier establecimiento.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const admin = createAdminClient();
  const establishmentId = request.nextUrl.searchParams.get("establishment_id");

  // Admin: solo asignaturas de un establecimiento de su alcance.
  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!establishmentId || !rules.some((r) => r.establishmentId === establishmentId)) {
      return NextResponse.json([]);
    }
  }

  let query = admin.from("courses").select(`
    id, name, code, establishment_id, is_active, min_session_minutes,
    is_certification_program, certification_feedback_mode, certification_block_paste,
    certification_watch_tab_switch, certification_email_notifications,
    certification_min_hours_between_sessions, max_session_minutes, max_session_messages,
    distraction_action, distraction_cut_threshold
  `).order("name");
  if (establishmentId) query = query.eq("establishment_id", establishmentId);

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { name, code, establishment_id } = await request.json();
  if (!name || !establishment_id) return NextResponse.json({ error: "name y establishment_id requeridos" }, { status: 400 });

  // Un admin solo crea asignaturas en un establecimiento que administra COMPLETO
  // (regla sin acotar). Si su alcance está limitado a una asignatura/sección, la
  // asignatura nueva nacería fuera de su propio perímetro.
  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    if (!scopeAllowsEstablishmentWide({ all: false, rules }, establishment_id)) {
      return NextResponse.json(
        { error: "Su alcance está acotado a una asignatura: no puede crear asignaturas nuevas" },
        { status: 403 },
      );
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("courses").insert({ name, code: code || null, establishment_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

/**
 * Ajusta la asignatura: su nombre y/o la expectativa de duración.
 *
 * El código no se edita por acá (se fija al crear). El alcance para renombrar
 * es el mismo con que la asignatura se muestra en el catálogo del admin
 * (`scopeAllowsCourse`, ver `visibleCourses` en la página que consume esto):
 * si la ve, la puede renombrar. Los minutos son solo informativos (un aviso
 * al finalizar antes de tiempo, nunca un bloqueo), así que tampoco hay razón
 * para restringirlos más que el resto del catálogo.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const {
    id, min_session_minutes, name,
    is_certification_program, certification_feedback_mode,
    certification_block_paste, certification_watch_tab_switch, certification_email_notifications,
    certification_min_hours_between_sessions, max_session_minutes, max_session_messages,
    distraction_action, distraction_cut_threshold,
  } = await request.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Cada campo se actualiza solo si vino en el body — un PATCH que solo manda
  // el nombre no debe pisar los minutos guardados, y viceversa.
  let minutos: number | null | undefined;
  if (min_session_minutes !== undefined) {
    minutos = null;
    // null apaga el aviso. Cualquier otra cosa tiene que ser un entero sensato:
    // la restricción también está en la base, pero un 400 explica mejor que un 500.
    if (min_session_minutes !== null && min_session_minutes !== "") {
      minutos = Number(min_session_minutes);
      if (!Number.isInteger(minutos) || minutos < 1 || minutos > 180) {
        return NextResponse.json({ error: "Los minutos deben ser un entero entre 1 y 180" }, { status: 400 });
      }
    }
  }

  let nombre: string | undefined;
  if (name !== undefined) {
    nombre = String(name).trim();
    if (!nombre) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
  }

  // Programa de certificación: mismo patrón (null/"" apaga el campo cuando
  // aplica, cualquier otra cosa se valida como entero sensato).
  const certUpdates: Record<string, unknown> = {};
  if (is_certification_program !== undefined) {
    certUpdates.is_certification_program = !!is_certification_program;
  }
  if (certification_feedback_mode !== undefined) {
    if (!["auto", "docente"].includes(certification_feedback_mode)) {
      return NextResponse.json({ error: "certification_feedback_mode debe ser 'auto' o 'docente'" }, { status: 400 });
    }
    certUpdates.certification_feedback_mode = certification_feedback_mode;
  }
  if (certification_block_paste !== undefined) certUpdates.certification_block_paste = !!certification_block_paste;
  if (certification_watch_tab_switch !== undefined) certUpdates.certification_watch_tab_switch = !!certification_watch_tab_switch;
  if (certification_email_notifications !== undefined) certUpdates.certification_email_notifications = !!certification_email_notifications;

  if (certification_min_hours_between_sessions !== undefined) {
    const horas = Number(certification_min_hours_between_sessions);
    if (!Number.isInteger(horas) || horas < 1) {
      return NextResponse.json({ error: "Las horas mínimas entre sesiones deben ser un entero positivo" }, { status: 400 });
    }
    certUpdates.certification_min_hours_between_sessions = horas;
  }
  if (max_session_minutes !== undefined) {
    let m: number | null = null;
    if (max_session_minutes !== null && max_session_minutes !== "") {
      m = Number(max_session_minutes);
      if (!Number.isInteger(m) || m < 1 || m > 240) {
        return NextResponse.json({ error: "El límite de minutos debe ser un entero entre 1 y 240" }, { status: 400 });
      }
    }
    certUpdates.max_session_minutes = m;
  }
  if (max_session_messages !== undefined) {
    let m: number | null = null;
    if (max_session_messages !== null && max_session_messages !== "") {
      m = Number(max_session_messages);
      if (!Number.isInteger(m) || m < 1 || m > 200) {
        return NextResponse.json({ error: "El límite de mensajes debe ser un entero entre 1 y 200" }, { status: 400 });
      }
    }
    certUpdates.max_session_messages = m;
  }
  if (distraction_action !== undefined) {
    if (!["cut", "alert_only"].includes(distraction_action)) {
      return NextResponse.json({ error: "distraction_action debe ser 'cut' o 'alert_only'" }, { status: 400 });
    }
    certUpdates.distraction_action = distraction_action;
  }
  if (distraction_cut_threshold !== undefined) {
    const umbral = Number(distraction_cut_threshold);
    if (!Number.isInteger(umbral) || umbral < 1) {
      return NextResponse.json({ error: "El umbral de distracción debe ser un entero positivo" }, { status: 400 });
    }
    certUpdates.distraction_cut_threshold = umbral;
  }

  if (minutos === undefined && nombre === undefined && Object.keys(certUpdates).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();

  // El alcance se comprueba contra el establecimiento REAL de la asignatura,
  // no contra uno que mande el cliente.
  const { data: course } = await admin
    .from("courses").select("id, establishment_id").eq("id", id).maybeSingle();
  if (!course) return NextResponse.json({ error: "Asignatura no encontrada" }, { status: 404 });

  if (callerRole === "admin") {
    const rules = await resolveAdminScopeRules(supabase, user.id);
    const alcanza = rules.some(
      (r) => r.establishmentId === course.establishment_id && (!r.courseId || r.courseId === course.id),
    );
    if (!alcanza) return NextResponse.json({ error: "Asignatura fuera de su alcance" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { ...certUpdates };
  if (minutos !== undefined) updates.min_session_minutes = minutos;
  if (nombre !== undefined) updates.name = nombre;

  const { error } = await admin
    .from("courses").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, ...updates });
}
