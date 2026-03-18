import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { title, fileName } = await request.json();

  try {
    const response = await chat(
      [{ role: "user", content: `Genera un resumen breve (2-3 oraciones) para un informe técnico de la plataforma GlorIA (plataforma de entrenamiento clínico con IA para estudiantes de psicología).

Título del informe: "${title}"
Nombre del archivo: "${fileName}"

El resumen debe ser profesional, conciso y describir el probable contenido del documento basándose en su título. Responde SOLO con el texto del resumen, sin comillas ni formato adicional.` }],
      "Eres un asistente que genera resúmenes concisos de documentos técnicos. Responde solo con el texto del resumen."
    );

    return NextResponse.json({ summary: response.trim() });
  } catch {
    return NextResponse.json({ error: "Error generando resumen" }, { status: 500 });
  }
}
