/**
 * Paciente de GlorIA dentro de Mundo UGM (espacio 2D de la universidad).
 *
 * Lo llama SOLO el servidor de Mundo UGM con `Authorization: Bearer
 * MUNDO_UGM_CHAT_SECRET`; sin esa variable la ruta no existe (404). Cada
 * persona de Mundo UGM tiene aquí su cuenta de alumno (ver mundoAccount): la de
 * su correo si ya existe en GlorIA; si no, se crea con ese correo en la sección
 * MUNDO_UGM_SECTION_ID (y su asignatura e institución). Así memoria entre
 * sesiones, número de sesión, estado clínico, alertas y evaluación son los mismos
 * que en la app: el turno lo produce runChatTurn, igual que /api/chat.
 *
 * Acciones (POST JSON; user = {id, name, email?}):
 *   { action: "patient", patientId }                         → ficha pública (nombre, edad, apariencia)
 *   { action: "account", user, password? }                   → crea o vincula la cuenta (sin paciente)
 *   { action: "message", patientId, user, message | messages }  → SSE de /api/chat
 *   { action: "history", patientId, user }                   → mensajes de la sesión abierta (si hay)
 *   { action: "end", patientId, user }                       → cierra la sesión activa y la evalúa
 *   { action: "evaluation", patientId, user }                → evaluación de la última sesión cerrada
 *
 * Solo los pacientes de MUNDO_UGM_PATIENT_IDS (lista separada por comas).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { runChatTurn } from "@/lib/chat-turn";
import { runSessionComplete } from "@/lib/session-complete";
import { getPatientImageUrl, getPatientVideoUrl } from "@/lib/patient-assets";
import { COMPETENCY_LABELS_V2 } from "@/lib/gamification";

// Mismo slug que usa la app para los retratos y videos (PatientShowcase).
const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

const userSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
  name: z.string().min(1).max(80),
  email: z.string().email().max(254).optional(),
});
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("patient"), patientId: z.string().uuid() }),
  z.object({ action: z.literal("account"), user: userSchema, password: z.string().min(8).max(128).optional() }),
  z.object({ action: z.literal("evaluation"), patientId: z.string().uuid(), user: userSchema }),
  z.object({
    action: z.literal("message"),
    patientId: z.string().uuid(),
    user: userSchema,
    message: z.string().min(1).max(5000).optional(),
    messages: z.array(z.string().min(1).max(5000)).min(1).max(8).optional(),
  }),
  z.object({ action: z.literal("history"), patientId: z.string().uuid(), user: userSchema }),
  z.object({ action: z.literal("end"), patientId: z.string().uuid(), user: userSchema }),
]);

type Admin = ReturnType<typeof createAdminClient>;
type SessionClient = Awaited<ReturnType<typeof createClient>>;

function authorized(request: NextRequest): boolean | null {
  const secret = process.env.MUNDO_UGM_CHAT_SECRET;
  if (!secret) return null;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const allowedPatients = () =>
  new Set((process.env.MUNDO_UGM_PATIENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));

// Sección «Mundo UGM» (MUNDO_UGM_SECTION_ID): de ella salen la asignatura y la
// institución con que se crean las cuentas, para que las vean sus docentes.
type Placement = { establishment_id: string; course_id: string; section_id: string };
let placementCache: { at: number; value: Placement | null } | null = null;
async function mundoPlacement(admin: Admin): Promise<Placement | null> {
  const sectionId = process.env.MUNDO_UGM_SECTION_ID;
  if (!sectionId) return null;
  if (placementCache && Date.now() - placementCache.at < 10 * 60_000) return placementCache.value;
  const { data } = await admin
    .from("sections")
    .select("id, course_id, courses(establishment_id)")
    .eq("id", sectionId)
    .maybeSingle();
  const course = data?.courses as unknown as { establishment_id: string } | null;
  const value = data && course ? { establishment_id: course.establishment_id, course_id: data.course_id, section_id: data.id } : null;
  placementCache = { at: Date.now(), value };
  return value;
}

type Account = { id: string; status: "linked" | "created" | "mirror" };

// Cuenta de GlorIA de una persona de Mundo UGM:
//  - con correo y ya existe en GlorIA → esa misma cuenta (no se le cambia nada);
//  - con correo y no existe → se crea con ese correo (alumno, sección Mundo UGM).
//    Si ya tenía cuenta espejo (de antes de mandar el correo), esa pasa a usar el
//    correo real y conserva sus sesiones. `password` (la clave temporal de Mundo
//    UGM) solo se usa al crear; si no viene, entra con «¿Olvidaste tu contraseña?»;
//  - sin correo (cuentas antiguas) → cuenta espejo mundo-ugm+<id>@mundo-ugm.invalid.
async function mundoAccount(admin: Admin, u: z.infer<typeof userSchema>, password?: string): Promise<Account | null> {
  const mirrorEmail = `mundo-ugm+${u.id.toLowerCase()}@mundo-ugm.invalid`;
  const email = u.email?.trim().toLowerCase();
  const place = await mundoPlacement(admin);

  if (email) {
    const { data: real } = await admin.from("profiles").select("id").ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (real) return { id: real.id, status: "linked" };
  }
  const { data: mirror } = await admin.from("profiles").select("id, full_name, section_id").eq("email", mirrorEmail).maybeSingle();
  if (mirror) {
    const updates: Record<string, unknown> = {};
    if (mirror.full_name !== u.name) updates.full_name = u.name;
    if (place && !mirror.section_id) Object.assign(updates, place);
    if (email) {
      const { error } = await admin.auth.admin.updateUserById(mirror.id, { email, email_confirm: true });
      if (error) console.error("[external/patient-chat] no se pudo pasar la cuenta espejo al correo real", error.message);
      else updates.email = email;
    }
    if (Object.keys(updates).length) await admin.from("profiles").update(updates).eq("id", mirror.id);
    return { id: mirror.id, status: updates.email ? "created" : "mirror" };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: email || mirrorEmail,
    password: (email && password) || randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: u.name, establishment_id: place?.establishment_id },
  });
  if (error || !data?.user) {
    console.error("[external/patient-chat] no se pudo crear la cuenta", error?.message);
    return null;
  }
  // El trigger handle_new_user crea el perfil con la institución; aquí se completan
  // asignatura y sección.
  if (place) await admin.from("profiles").update(place).eq("id", data.user.id);
  return { id: data.user.id, status: email ? "created" : "mirror" };
}

// runChatTurn / runSessionComplete leen el cuerpo de la petición: se les arma una
// nueva con lo que esperan las rutas de la app.
const innerRequest = (request: NextRequest, path: string, body: unknown) =>
  new NextRequest(new URL(path, request.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export async function POST(request: NextRequest) {
  const ok = authorized(request);
  if (ok === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const admin = createAdminClient();

  if (body.action === "account") {
    const account = await mundoAccount(admin, body.user, body.password);
    if (!account) return NextResponse.json({ error: "No se pudo preparar la cuenta" }, { status: 500 });
    return NextResponse.json({ status: account.status, url: new URL("/login", request.url).href });
  }

  if (!allowedPatients().has(body.patientId)) {
    return NextResponse.json({ error: "Paciente no habilitado" }, { status: 404 });
  }

  if (body.action === "patient") {
    const { data } = await admin
      .from("ai_patients")
      .select("id, name, age, occupation, quote, visual_identity, difficulty_level")
      .eq("id", body.patientId)
      .single();
    if (!data) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    // Retrato y video (la "cámara" del paciente en la app).
    const slug = slugify(data.name);
    return NextResponse.json({ ...data, media: { image: getPatientImageUrl(slug), video: getPatientVideoUrl(slug) } });
  }

  const account = await mundoAccount(admin, body.user);
  if (!account) return NextResponse.json({ error: "No se pudo preparar la cuenta" }, { status: 500 });
  const userId = account.id;
  // Mismas consultas que con la sesión del alumno, todas filtradas por su id.
  const client = admin as unknown as SessionClient;

  if (body.action === "message") {
    // Sin conversationId: la app retoma la sesión activa de este alumno con este
    // paciente o abre una nueva (nunca una conversación ajena).
    const inner = innerRequest(request, "/api/chat", {
      patientId: body.patientId,
      ...(body.messages ? { messages: body.messages } : { message: body.message }),
    });
    return runChatTurn(inner, client, { id: userId });
  }

  if (body.action === "evaluation") return evaluation(admin, request, userId, body.patientId);

  const { data: conv } = await admin
    .from("conversations")
    .select("id, created_at, session_number")
    .eq("student_id", userId)
    .eq("ai_patient_id", body.patientId)
    .in("status", ["active", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (body.action === "history") {
    if (!conv) return NextResponse.json({ messages: [] });
    const { data: msgs } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(200);
    return NextResponse.json({ messages: msgs || [], startedAt: conv.created_at, sessionNumber: conv.session_number });
  }
  // end
  if (!conv) return NextResponse.json({ error: "No hay una sesión abierta" }, { status: 404 });
  // fast=true: responde al tiro y evalúa en segundo plano (como el piloto).
  return runSessionComplete(innerRequest(request, `/api/sessions/${conv.id}/complete?fast=true`, {}), client, { id: userId }, conv.id);
}

// Evaluación de la última sesión cerrada con este paciente, como la ve el alumno
// en GlorIA: si el curso la deja en revisión docente, todavía no se muestran los
// puntajes (status "review"); si el evaluador no termina, "pending".
async function evaluation(admin: Admin, request: NextRequest, userId: string, patientId: string) {
  const { data: conv } = await admin
    .from("conversations")
    .select("id, session_number, ended_at")
    .eq("student_id", userId)
    .eq("ai_patient_id", patientId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!conv) return NextResponse.json({ status: "none" });
  const base = { sessionNumber: conv.session_number, endedAt: conv.ended_at, url: new URL(`/review/${conv.id}`, request.url).href };
  const { data: ev } = await admin
    .from("session_competencies")
    .select("*")
    .eq("conversation_id", conv.id)
    .maybeSingle();
  if (!ev) return NextResponse.json({ status: "pending", ...base });
  if (ev.feedback_status !== "approved") return NextResponse.json({ status: "review", ...base });
  const row = ev as Record<string, unknown>;
  const competencies = Object.entries(COMPETENCY_LABELS_V2)
    .map(([key, label]) => ({ key, label, score: row[key] == null ? null : Number(row[key]) }));
  return NextResponse.json({
    status: "ready",
    ...base,
    overall: ev.overall_score_v2 == null ? null : Number(ev.overall_score_v2),
    competencies,
    commentary: ev.ai_commentary || "",
    strengths: ev.strengths || [],
    areas: ev.areas_to_improve || [],
  });
}
