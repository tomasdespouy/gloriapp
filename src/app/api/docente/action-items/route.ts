import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

// GET: list action items for a conversation or student
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  const studentId = request.nextUrl.searchParams.get("student_id");

  const admin = createAdminClient();
  let query = admin.from("action_items").select("*").order("created_at", { ascending: false });

  if (conversationId) query = query.eq("conversation_id", conversationId);
  if (studentId) query = query.eq("student_id", studentId);

  const { data } = await query;
  return NextResponse.json(data || []);
}

// POST: create action items (manual or AI-suggested)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "instructor" && profile?.role !== "admin" && profile?.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();

  // AI supervisor comment generation
  if (body.action === "suggest_comment") {
    const { student_name, evaluation_summary } = body;
    const commentSuggestion = await chat(
      [{ role: "user", content: `Eres un docente supervisor de psicología clínica con enfoque formativo.

Un estudiante llamado ${student_name} completó una sesión de práctica. Resumen de la evaluación IA:

${evaluation_summary}

Genera un comentario de supervisión de 3-5 oraciones que:
1. Reconozca fortalezas específicas
2. Señale áreas de mejora con empatía y concreción
3. Ofrezca una sugerencia práctica para la próxima sesión
4. Use un tono cálido y profesional

Responde SOLO con el comentario, sin introducción.` }],
      "Eres un supervisor clínico formativo. Responde en español."
    );
    return NextResponse.json({ comment: commentSuggestion });
  }

  // AI suggestion mode
  if (body.action === "suggest") {
    const { conversation_id, student_name, evaluation_summary } = body;

    const suggestion = await chat(
      [{ role: "user", content: `Eres un docente supervisor de psicología clínica con mentalidad de crecimiento.

Un estudiante llamado ${student_name} completó una sesión de práctica. Aquí está el resumen de la evaluación:

${evaluation_summary}

Genera 3-5 accionables específicos para la próxima sesión. Cada accionable debe:
1. Ser específico y observable (no genérico)
2. Tener mentalidad de crecimiento (no punitivo)
3. Incluir una acción concreta que el estudiante puede practicar
4. Si es pertinente, sugerir un módulo de aprendizaje de la plataforma

Formato: una línea por accionable, sin numeración. Ejemplo:
Practicar reformulaciones usando la estructura "Si entiendo bien, lo que me dice es..." en los primeros 5 minutos de la sesión
Revisar el módulo de Escucha Activa en la sección de Aprendizaje antes de la próxima sesión

Responde SOLO con los accionables, sin introducción ni cierre.` }],
      "Eres un supervisor clínico con mentalidad de crecimiento. Responde en español."
    );

    const items = suggestion.split("\n").filter((l) => l.trim().length > 10);
    return NextResponse.json({ suggestions: items });
  }

  // Manual creation mode
  const { conversation_id, student_id, items } = body;
  if (!conversation_id || !student_id || !items?.length) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const toInsert = items.map((item: { content: string; resource_link?: string }) => ({
    conversation_id,
    student_id,
    teacher_id: user.id,
    content: item.content,
    resource_link: item.resource_link || null,
  }));

  const { error } = await admin.from("action_items").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify student
  await admin.from("notifications").insert({
    user_id: student_id,
    type: "action_items",
    title: "Nuevos accionables de tu docente",
    body: `Tu docente te dejó ${items.length} accionable(s) para revisar y validar.`,
    href: `/historial`,
  });

  return NextResponse.json({ success: true, count: items.length });
}
