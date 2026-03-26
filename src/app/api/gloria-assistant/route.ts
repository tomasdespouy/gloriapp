import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatStream } from "@/lib/ai";
import { Resend } from "resend";

const GLORIA_SYSTEM_PROMPT = `Eres GlorIA, la tutora virtual de una plataforma de entrenamiento clínico con pacientes simulados por IA para estudiantes de psicología.

TU PERSONALIDAD:
- Cálida, cercana, profesional pero no rígida
- Hablas en español, con tildes correctas
- Usas un tono de supervisora clínica empática: acompañas sin juzgar
- Eres concisa — respondes en 2-4 oraciones a menos que te pidan más detalle
- Tuteas al estudiante

LO QUE PUEDES HACER:
- Orientar sobre la plataforma: cómo practicar, ver historial, entender evaluaciones
- Explicar competencias terapéuticas (Pauta de Valdés & Gómez, 2023)
- Interpretar scores (escala 0-4): 0=no aplicaba, 1=deficiente, 2=básico, 3=adecuado, 4=excelente
- Motivar y acompañar emocionalmente al estudiante
- Sugerir qué paciente practicar según su nivel
- Recopilar problemas técnicos para enviarlos al equipo de soporte

NAVEGACIÓN DE LA PLATAFORMA (usa estos links cuando refieras a secciones):
- Inicio: /dashboard
- Pacientes (practicar): /pacientes
- Mi historial: /historial
- Mi progreso: /progreso
- Aprendizaje: /aprendizaje
- Mi perfil: /mi-perfil
- Soporte técnico: /soporte

Cuando menciones una sección o paciente, incluye el link en formato markdown: [nombre](/ruta)

LO QUE NO HACES:
- No das diagnósticos clínicos reales
- No reemplazas al docente supervisor
- No respondes sobre temas fuera de psicología clínica y la plataforma
- No inventas datos del estudiante que no tienes

CONTEXTO DEL ESTUDIANTE (úsalo para personalizar, incluyendo en qué página está ahora):
{STUDENT_CONTEXT}

Si el estudiante reporta un problema técnico, responde algo como: "Entiendo, voy a enviar esto al equipo técnico para que lo revisen. Te van a responder a tu correo." y agrega al final de tu mensaje exactamente esta etiqueta: [SUPPORT_TICKET]`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const body = await request.json();
  const { messages, currentPage } = body as { messages: { role: string; content: string }[]; currentPage?: string };

  if (!messages || messages.length === 0) {
    return new Response("Sin mensajes", { status: 400 });
  }

  const admin = createAdminClient();

  const [{ data: profile }, { data: progress }, { data: patients }] = await Promise.all([
    admin.from("profiles").select("full_name, email, role").eq("id", user.id).single(),
    admin.from("student_progress").select("*").eq("student_id", user.id).maybeSingle(),
    admin.from("ai_patients").select("id, name, difficulty_level").eq("is_active", true).order("name"),
  ]);

  const name = profile?.full_name || "estudiante";
  const ctx = [
    `Nombre: ${name}`,
    `Rol: ${profile?.role || "student"}`,
    progress ? `Nivel: ${progress.level} (${progress.level_name})` : null,
    progress ? `XP total: ${progress.total_xp}` : null,
    progress ? `Sesiones completadas: ${progress.sessions_completed}` : null,
    progress?.current_streak ? `Racha actual: ${progress.current_streak} días` : null,
    progress?.last_session_date ? `Última sesión: ${progress.last_session_date}` : null,
    currentPage ? `Página actual: ${currentPage}` : null,
    patients && patients.length > 0
      ? `Pacientes disponibles (usa estos links cuando sugieras practicar):\n${patients.map(p => `- [${p.name}](/chat/${p.id}) (${p.difficulty_level})`).join("\n")}`
      : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = GLORIA_SYSTEM_PROMPT.replace("{STUDENT_CONTEXT}", ctx);

  const llmStream = chatStream(
    messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    systemPrompt
  );

  // Wrap the LLM stream: collect full text for support ticket detection, pass chunks through
  let fullText = "";
  const userMessages = messages.filter(m => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";

  const outputStream = new ReadableStream({
    async start(controller) {
      const reader = llmStream.getReader();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += value;
          controller.enqueue(encoder.encode(value));
        }
      } finally {
        reader.releaseLock();
        controller.close();

        // After stream completes, check for support ticket (fire-and-forget)
        if (fullText.includes("[SUPPORT_TICKET]")) {
          try {
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
              const resend = new Resend(resendKey);
              await resend.emails.send({
                from: "GlorIA <onboarding@resend.dev>",
                to: process.env.SUPPORT_EMAIL || "tomasdespouy@gmail.com",
                replyTo: profile?.email || user.email || undefined,
                subject: `[GlorIA Soporte] Ticket de ${name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
                    <h2 style="color: #4A55A2;">Ticket de soporte via GlorIA</h2>
                    <p><strong>Estudiante:</strong> ${name} (${profile?.email})</p>
                    <p><strong>Nivel:</strong> ${progress?.level_name || "N/A"} (${progress?.sessions_completed || 0} sesiones)</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
                    <p><strong>Problema reportado:</strong></p>
                    <p style="background: #f9f9f9; padding: 12px; border-radius: 8px;">${lastUserMsg}</p>
                  </div>
                `,
              });
            }
          } catch { /* non-critical */ }
        }
      }
    },
  });

  return new Response(outputStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
