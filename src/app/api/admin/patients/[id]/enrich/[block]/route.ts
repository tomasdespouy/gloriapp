/**
 * INF-2026-050: endpoint que invoca gpt-4o para generar el borrador de un bloque
 * de enriquecimiento específico (red_social | lugares | estado_corporal | frases_tipo)
 * para un paciente dado.
 *
 * NO escribe a la base. Devuelve el draft al cliente, que lo persiste cuando el
 * editor humano aprueba.
 *
 * Auth: superadmin only (siguiendo patrón de /api/admin/patients/all).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";

const VALID_BLOCKS = ["red_social", "lugares", "estado_corporal", "frases_tipo"] as const;
type Block = (typeof VALID_BLOCKS)[number];

const BLOCK_TO_KEY: Record<Block, string> = {
  red_social: "red_social_y_vinculos",
  lugares: "lugares_significativos",
  estado_corporal: "estado_corporal_y_rutina",
  frases_tipo: "frases_tipo_que_dices",
};

const BLOCK_DESCRIPTIONS: Record<Block, string> = {
  red_social:
    "RED SOCIAL Y VÍNCULOS (5-8 líneas): familia ya conocida con detalles + 1-3 personas del círculo cotidiano (vecinos, compañeros, amigos), cada uno con nombre, rol y micro-historia. Concretar ocupaciones, lugares de trabajo o estudio.",
  lugares:
    "LUGARES SIGNIFICATIVOS (3-5 líneas): lugares físicos concretos del día a día con detalle sensorial específico. Pueden ser de su barrio, su trabajo, lugares con carga emocional.",
  estado_corporal:
    "ESTADO CORPORAL Y RUTINA (4-6 líneas): sueño, apetito, cuerpo, vestimenta, rutina. COHERENTE con el motivo de consulta (un paciente con duelo agudo come distinto que uno con burnout).",
  frases_tipo:
    "FRASES TIPO QUE DICES (6-8 líneas): frases breves entre comillas que el paciente diría en sesión. Anclas tonales del dialecto del país. NO frases meta-clínicas; frases naturales.",
};

const META_PROMPT = `Eres experto en construcción de pacientes simulados para entrenamiento clínico de psicología. Recibes los datos de un paciente IA existente y debes generar un bloque específico de contenido nuevo para enriquecer su prompt sistémico.

OBJETIVO: agregar densidad biográfica concreta sin tocar la estructura clínica del prompt.

REGLAS DURAS:
1. Coherencia absoluta con la familia (family_members) ya definida. Si la familia tiene a "Patricia, 45, madre", úsala con ese nombre y edad.
2. Dialecto del país de origen del paciente (Chile: cachai/igual/po; Perú: pe/pues/oe; Colombia: parcera/vea; México: ándale/órale; Argentina: che/dale; Rep. Dominicana: vaina/loco; etc.).
3. Coherencia con la edad, ocupación, motivo de consulta y barrio.
4. NUNCA inventes contenido que contradiga el prompt original.
5. NUNCA agregues elementos clínicos nuevos que cambien el cuadro.
6. NO uses emojis.
7. Mantén el formato de líneas con guion (-) y datos concretos, sin generalidades vacías.

FORMATO DE SALIDA: JSON estricto con UNA sola clave correspondiente al bloque pedido. El valor empieza con el título del bloque en mayúsculas seguido de ":", luego el cuerpo en líneas con guion.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; block: string }> }
) {
  const { id, block } = await params;

  // 1) Auth: superadmin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin" && profile?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 2) Validate block name
  if (!VALID_BLOCKS.includes(block as Block)) {
    return NextResponse.json(
      { error: `Invalid block. Must be one of: ${VALID_BLOCKS.join(", ")}` },
      { status: 400 }
    );
  }
  const blockKey = BLOCK_TO_KEY[block as Block];
  const blockSpec = BLOCK_DESCRIPTIONS[block as Block];

  // 3) Fetch patient (admin client bypasses RLS)
  const admin = createAdminClient();
  const { data: patientRaw, error: pErr } = await admin
    .from("ai_patients")
    .select(
      "id, name, age, occupation, quote, presenting_problem, backstory, system_prompt, " +
        "country, country_origin, country_residence, neighborhood, family_members, " +
        "visual_identity, difficulty_level, tags"
    )
    .eq("id", id)
    .single();

  if (pErr || !patientRaw) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Workaround: supabase-js infiere un tipo demasiado amplio cuando el
  // select tiene muchas columnas; el narrowing por (pErr || !patientRaw)
  // no lo reduce. Cast explícito al shape conocido.
  const patient = patientRaw as unknown as {
    id: string;
    name: string;
    age: number;
    occupation: string;
    quote: string;
    presenting_problem: string;
    backstory: string;
    system_prompt: string;
    country: string | string[] | null;
    country_origin: string | null;
    country_residence: string | null;
    neighborhood: string | null;
    family_members: Array<{ name: string; age: number; relationship: string; notes?: string }> | null;
    visual_identity: { etnia?: string; gesto?: string; ropa_tipo?: string; ropa_color?: string } | null;
    difficulty_level: string;
    tags: string[] | null;
  };

  // 4) Build context for gpt-4o
  const country = Array.isArray(patient.country) ? patient.country.join("/") : patient.country;
  const family = (patient.family_members ?? [])
    .map((f: { name: string; age: number; relationship: string; notes?: string }) =>
      `${f.name} (${f.age}, ${f.relationship})${f.notes ? ` — ${f.notes}` : ""}`
    )
    .join("; ");
  const visual = patient.visual_identity ?? {};

  const userMsg = `DATOS DEL PACIENTE
- Nombre: ${patient.name}
- Edad: ${patient.age}
- Ocupación: ${patient.occupation}
- País: ${country}
- Barrio: ${patient.neighborhood || "(no especificado)"}
- Cita: "${patient.quote}"
- Motivo de consulta: ${patient.presenting_problem}
- Dificultad: ${patient.difficulty_level}
- Tags: ${(patient.tags ?? []).join(", ")}
- Backstory: ${patient.backstory}
- Familia conocida: ${family || "(no especificada)"}
- Identidad visual: ${visual.etnia || "?"}, ${visual.gesto || "?"}, ${visual.ropa_tipo || "?"} ${visual.ropa_color || ""}

PROMPT ACTUAL DEL PACIENTE (para mantener coherencia tonal):
${patient.system_prompt}

GENERA SOLO EL BLOQUE: ${blockSpec}

Devuelve JSON con la clave "${blockKey}" cuyo valor es el texto del bloque (string).`;

  // 5) Call OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });
  let json: Record<string, string>;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: META_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });
    json = JSON.parse(completion.choices[0].message.content || "{}");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI error";
    return NextResponse.json({ error: `OpenAI: ${msg}` }, { status: 502 });
  }

  const text = json[blockKey];
  if (typeof text !== "string" || text.length < 30) {
    return NextResponse.json(
      { error: "El modelo no devolvió un bloque válido", raw: json },
      { status: 502 }
    );
  }

  return NextResponse.json({
    block: {
      name: block,
      text,
      generated_by: "ai",
      generated_at: new Date().toISOString(),
      model: "gpt-4o",
    },
  });
}

/**
 * PATCH — persiste el bloque aprobado por el editor humano.
 * Body: { text: string, generated_by?: "ai" | "human" }
 *
 * Side effects:
 *   - UPDATE ai_patients SET enrichment_<block> = ..., enrichment_version = +1,
 *       enrichment_approved_by = user.id, enrichment_approved_at = NOW()
 *   - INSERT INTO enrichment_history (audit trail)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; block: string }> }
) {
  const { id, block } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin" && profile?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!VALID_BLOCKS.includes(block as Block)) {
    return NextResponse.json(
      { error: `Invalid block. Must be one of: ${VALID_BLOCKS.join(", ")}` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || text.trim().length < 30) {
    return NextResponse.json(
      { error: "Body debe incluir 'text' de al menos 30 caracteres" },
      { status: 400 }
    );
  }
  const generated_by: "ai" | "human" = body?.generated_by === "ai" ? "ai" : "human";

  const admin = createAdminClient();

  // 1) Read current version
  const { data: current } = await admin
    .from("ai_patients")
    .select("enrichment_version")
    .eq("id", id)
    .single();

  if (!current) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const nextVersion = (current.enrichment_version ?? 0) + 1;
  const now = new Date().toISOString();

  const blockJson = {
    text: text.trim(),
    version: nextVersion,
    generated_by,
    generated_at: now,
    model: generated_by === "ai" ? "gpt-4o" : null,
  };

  const columnName = `enrichment_${block}`;

  // 2) UPDATE ai_patients
  const { error: updErr } = await admin
    .from("ai_patients")
    .update({
      [columnName]: blockJson,
      enrichment_version: nextVersion,
      enrichment_approved_by: user.id,
      enrichment_approved_at: now,
    })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: `Update failed: ${updErr.message}` }, { status: 500 });
  }

  // 3) INSERT enrichment_history (audit trail)
  await admin.from("enrichment_history").insert({
    patient_id: id,
    block_name: block,
    version: nextVersion,
    content: blockJson,
    generated_by,
    approved_by: user.id,
    approved_at: now,
  });

  return NextResponse.json({
    ok: true,
    version: nextVersion,
    block: blockJson,
  });
}
