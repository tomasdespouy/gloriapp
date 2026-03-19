import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { idea } = await request.json();
  if (!idea?.trim()) return NextResponse.json({ error: "Describe tu idea" }, { status: 400 });

  const prompt = `Eres el equipo de comunicaciones de GlorIA, una plataforma de formación clínica con pacientes simulados por IA para estudiantes de psicología en universidades de Latinoamérica.

Genera un correo electrónico profesional basado en esta idea: "${idea.trim()}"

REGLAS:
- Tono profesional pero cálido
- Español con tildes correctas
- Tutea al destinatario (tú/tu, no usted)
- Firma como "Equipo GlorIA"
- Si hay datos que completar, usa marcadores como [FECHA], [HORA], [LINK], etc.
- Máximo 150 palabras en el cuerpo
- No incluyas el asunto en el cuerpo

Responde EXACTAMENTE en este formato (sin markdown, sin comillas):
ASUNTO: [el asunto aquí]
---
[el cuerpo del correo aquí]`;

  const response = await chat(
    [{ role: "user", content: prompt }],
    "Eres un redactor de comunicaciones institucionales para una plataforma educativa de IA."
  );

  if (!response) return NextResponse.json({ error: "Error generando correo" }, { status: 500 });

  // Parse response
  const parts = response.split("---");
  const subjectLine = (parts[0] || "").replace(/^ASUNTO:\s*/i, "").trim();
  const bodyText = (parts.slice(1).join("---") || "").trim();

  return NextResponse.json({
    subject: subjectLine,
    body: bodyText,
  });
}
