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
    const { student_name, evaluation_summary, style } = body;
    const firstName = student_name?.split(" ")[0] || "estudiante";
    const isDescriptive = style === "descriptive";

    const styleInstructions = isDescriptive
      ? `Escribe en párrafos narrativos fluidos (NO en formato de punteo/lista).
Párrafo 1: Saludo y valoración del espacio de supervisión y la formación clínica.
Párrafo 2: Describe las fortalezas observadas con detalle y citas textuales integradas en la narrativa.
Párrafo 3: Describe las oportunidades de mejora con empatía, integrando citas textuales que ilustren.
Párrafo 4: Propón accionables concretos para la próxima sesión.
Párrafo 5: Cierre mencionando que habrá un espacio conjunto para profundizar en esta retroalimentación.`
      : `Usa formato estructurado con este esquema:

Hola ${firstName},

[1-2 oraciones valorando el espacio de supervisión y la importancia de la formación clínica]

Puntos fuertes:
1. [fortaleza específica con referencia a lo observado]
2. [otra fortaleza]

Oportunidades de mejora:
1. [área de mejora con empatía y concreción]
2. [otra área]

Citas textuales relevantes:
- "[cita del estudiante que ilustre una fortaleza o área de mejora]"
- "[otra cita relevante]"

Accionables para la próxima sesión:
- [accionable específico y observable]
- [otro accionable]

[Cierre motivador mencionando que habrá un espacio conjunto para profundizar en esta retroalimentación]`;

    const commentSuggestion = await chat(
      [{ role: "user", content: `Eres un docente supervisor de psicología clínica con enfoque formativo.

Un estudiante llamado ${student_name} completó una sesión de práctica. Resumen de la evaluación IA:

${evaluation_summary}

Genera un comentario de supervisión con el siguiente estilo:

${styleInstructions}

Responde SOLO con el comentario.` }],
      "Eres un supervisor clínico formativo. Responde en español con tildes correctas."
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

Genera exactamente 3 accionables específicos para la próxima sesión (ni más ni menos). Cada accionable debe:
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
