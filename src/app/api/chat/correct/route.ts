import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ corrected: text });

  const corrected = await chat(
    [{ role: "user", content: text }],
    `Corrige la ortografía y gramática del siguiente texto en español.
Reglas:
- Mantén EXACTAMENTE el mismo sentido y tono
- Solo corrige errores ortográficos, tildes faltantes, y puntuación básica
- NO cambies las palabras ni la estructura
- NO agregues contenido nuevo
- Si el texto ya está correcto, devuélvelo igual
- Responde SOLO con el texto corregido, sin explicaciones ni comillas`
  );

  return NextResponse.json({ corrected: corrected.trim() });
}
