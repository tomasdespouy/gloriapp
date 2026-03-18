import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";
import { NextResponse } from "next/server";
// pdf-parse loaded dynamically to avoid bundling issues

export const maxDuration = 60; // Allow up to 60s for AI analysis

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Error leyendo formulario" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. Upload file to Supabase Storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${Date.now()}_${safeName}`;

  const { error: uploadError } = await admin.storage
    .from("research")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Error subiendo: " + uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("research").getPublicUrl(filePath);
  const fileUrl = urlData.publicUrl;

  // 2. Extract text from PDF
  let textContent = `Archivo: ${file.name}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse(buffer);
    const parsed = await parser.parse();
    textContent = (parsed.text || "").substring(0, 12000);
  } catch {
    // PDF parsing failed - continue with filename only
  }

  // 3. AI analysis
  let aiResult = {
    title: file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
    type: "paper" as string,
    authors: [] as string[],
    year: null as string | null,
    venue: null as string | null,
    summary: null as string | null,
    tags: [] as string[],
  };

  try {
    const response = await chat(
      [{ role: "user", content: `Analiza este documento académico y extrae la información en JSON.

CONTENIDO:
${textContent}

ARCHIVO: ${file.name}

Responde SOLO con JSON válido:
{"title":"...","type":"paper|presentation|poster|proposal|report","authors":["..."],"year":"2025","venue":"...","summary":"resumen 3-4 líneas en español","tags":["tag1","tag2"]}

Si no puedes extraer un campo, usa null. Tags en español.` }],
      "Eres un experto en análisis de documentos académicos. Responde SOLO JSON válido, sin markdown."
    );

    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Escape control chars inside JSON strings
    let out = "";
    let inStr = false;
    let esc = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (esc) { out += ch; esc = false; continue; }
      if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = !inStr; out += ch; continue; }
      if (inStr) {
        if (ch === "\n") { out += "\\n"; continue; }
        if (ch === "\r") { out += "\\r"; continue; }
        if (ch === "\t") { out += "\\t"; continue; }
      }
      out += ch;
    }

    const parsed = JSON.parse(out);
    aiResult = { ...aiResult, ...parsed };
  } catch {
    // AI failed - save with defaults from filename
  }

  // 4. Save to database
  const { data: paper, error: dbError } = await admin
    .from("research_papers")
    .insert({
      title: aiResult.title,
      type: aiResult.type,
      authors: aiResult.authors,
      abstract: aiResult.summary,
      venue: aiResult.venue,
      date: aiResult.year ? (aiResult.year.length === 4 ? `${aiResult.year}-01-01` : aiResult.year) : null,
      file_url: fileUrl,
      tags: aiResult.tags,
      content_summary: aiResult.summary,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: "Error guardando: " + dbError.message }, { status: 500 });
  }

  return NextResponse.json({ paper, aiResult });
}
