/**
 * Paciente de GlorIA dentro de Mundo UGM (espacio 2D de la universidad).
 *
 * Lo llama SOLO el servidor de Mundo UGM con `Authorization: Bearer
 * MUNDO_UGM_CHAT_SECRET`; sin esa variable la ruta no existe (404). Cada
 * persona de Mundo UGM tiene aquí una cuenta espejo (alumno, correo
 * mundo-ugm+<id>@mundo-ugm.invalid, sin contraseña utilizable), así que memoria
 * entre sesiones, número de sesión, estado clínico, alertas y evaluación son
 * los mismos que en la app: el turno lo produce runChatTurn, igual que /api/chat.
 *
 * Acciones (POST JSON):
 *   { action: "patient", patientId }                         → ficha pública (nombre, edad, apariencia)
 *   { action: "message", patientId, user: {id,name}, message | messages }  → SSE de /api/chat
 *   { action: "history", patientId, user: {id,name} }        → mensajes de la sesión abierta (si hay)
 *   { action: "end", patientId, user: {id,name} }            → cierra la sesión activa y la evalúa
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

// Mismo slug que usa la app para los retratos y videos (PatientShowcase).
const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

const userSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
  name: z.string().min(1).max(80),
});
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("patient"), patientId: z.string().uuid() }),
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

// Cuenta espejo de una persona de Mundo UGM: se crea la primera vez y se le
// actualiza el nombre si cambió.
async function mirrorUser(admin: Admin, u: { id: string; name: string }): Promise<string | null> {
  const email = `mundo-ugm+${u.id.toLowerCase()}@mundo-ugm.invalid`;
  const { data: found } = await admin.from("profiles").select("id, full_name").eq("email", email).maybeSingle();
  if (found) {
    if (found.full_name !== u.name) await admin.from("profiles").update({ full_name: u.name }).eq("id", found.id);
    return found.id;
  }
  const establishment = process.env.MUNDO_UGM_ESTABLISHMENT_ID || undefined;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: u.name, establishment_id: establishment },
  });
  if (error || !data?.user) {
    console.error("[external/patient-chat] no se pudo crear la cuenta espejo", error?.message);
    return null;
  }
  return data.user.id;
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
  if (!allowedPatients().has(body.patientId)) {
    return NextResponse.json({ error: "Paciente no habilitado" }, { status: 404 });
  }

  const admin = createAdminClient();

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

  const userId = await mirrorUser(admin, body.user);
  if (!userId) return NextResponse.json({ error: "No se pudo preparar la cuenta" }, { status: 500 });
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
