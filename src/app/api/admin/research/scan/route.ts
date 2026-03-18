/**
 * RESEARCH SCAN — Uses Perplexity Sonar for web-grounded search
 * Single-step: Perplexity searches the web and returns structured results with real citations
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";

const GLORIA_CONTEXT = `GlorIA es una plataforma de entrenamiento clínico con IA para estudiantes de psicología.

TECNOLOGÍAS CLAVE:
- Motor adaptativo de estado clínico (5 variables, 14 reglas de transición)
- Memory-Context Processing (MCP): memoria persistente inter-sesión
- RAG semántico con pgvector (62 entradas de conocimiento clínico)
- Clasificador NLP de intervenciones terapéuticas (11 categorías)
- Evaluación por competencias UGM (10 dimensiones, escala 0-4)
- Comunicación bidireccional via WebSocket (paciente interrumpe/reacciona)
- Dual model strategy (GPT-4o-mini chat + GPT-4o evaluación)
- Pacientes con diversidad cultural (Chile, Colombia, Perú, Rep. Dominicana, México, Argentina)

TEMAS DE INVESTIGACIÓN:
- IA en educación clínica
- Simulación de pacientes con LLM
- Evaluación de competencias terapéuticas
- Motor adaptativo para conversaciones clínicas
- RAG para coherencia clínica en chatbots
- Gamificación en formación de psicólogos
- Tecnología educativa en salud mental
- NLP aplicado a entrevistas terapéuticas`;

export const maxDuration = 60;

function getPerplexity() {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY no configurada");
  return new OpenAI({ apiKey: key, baseURL: "https://api.perplexity.ai" });
}

function escapeJsonControlChars(raw: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
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
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const sendEmail = body.sendEmail || false;
  const scanType = body.type || "conferences";

  try {
    const today = new Date().toISOString().split("T")[0];
    const pplx = getPerplexity();

    const conferencePrompt = `Busca conferencias, journals y call-for-papers REALES con deadlines entre ${today} y diciembre 2027 donde un proyecto como GlorIA podría participar.

${GLORIA_CONTEXT}

ÁREAS DE BÚSQUEDA:
1. Conferencias de IA en educación (AIED, AAAI workshops, NeurIPS workshops, ICALT)
2. Conferencias de tecnología educativa (EdTech, LAK, CSCL, L@S)
3. Conferencias de psicología clínica y formación (APA, EFPA, SIP, WCBCT)
4. Journals de simulación en salud (Simulation in Healthcare, Medical Education, BMC Medical Education)
5. Conferencias de NLP aplicado (ACL workshops, EMNLP, NAACL)
6. Conferencias latinoamericanas (CLEI, LACLO, congresos de psicología locales)
7. Journals de IA en salud mental (JMIR Mental Health, Frontiers in Psychiatry)`;

    const fundsPrompt = `Busca fondos concursables, grants y subsidios públicos REALES con convocatorias abiertas o próximas (2026-2027) donde un proyecto de tecnología educativa en salud mental como GlorIA podría postular.

${GLORIA_CONTEXT}

BUSCAR ESPECÍFICAMENTE:
1. ANID Chile: FONDECYT, Fondef IDeA, PIA, Anillos
2. CORFO Chile: Semilla, Crea y Valida, Prototipos de Innovación
3. Mineduc Chile: Fondos de mejoramiento de calidad, innovación docente
4. Fondos internacionales: BID, Banco Mundial, UNESCO
5. Grants de fundaciones: Wellcome Trust, Gates Foundation, Google.org
6. Fondos regionales: CONICET Argentina, Colciencias/MinCiencias Colombia, CONCYTEC Perú
7. Programas de la Unión Europea: Horizon Europe, Erasmus+
8. Fondos de innovación en salud digital`;

    const prompt = scanType === "funds" ? fundsPrompt : conferencePrompt;

    const response = await pplx.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: `Eres un investigador académico experto. Busca oportunidades REALES y ACTUALES en la web.
Responde ÚNICAMENTE con un JSON válido (array de objetos). Sin markdown, sin texto adicional.
TODA la información debe estar en ESPAÑOL.
INCLUYE las URLs reales de cada oportunidad que encuentres en la web.`
        },
        {
          role: "user",
          content: `${prompt}

Para cada oportunidad encontrada, devuelve:
- name: Nombre completo en español
- type: "conference" | "journal" | "call_for_papers" | "grant"
- organizer: Quién organiza (en español)
- deadline: Fecha de envío (YYYY-MM-DD o null)
- event_date: Fecha del evento (texto en español)
- location: Lugar (en español)
- url: URL real del sitio oficial
- gloria_fit: "high" | "medium" | "low"
- advantages: Array de 2-3 ventajas de GlorIA (en español)
- weaknesses: Array de 1-2 desafíos para GlorIA (en español)
- approach: Cómo abordar (1-2 oraciones en español)
- registration_cost: Costo de inscripción ("$300 USD", "Gratuito", "A confirmar")
- gloria_fit_summary: Párrafo en español de 2-3 líneas explicando por qué GlorIA calza
- deliverable: Qué entregar para el deadline ("Paper completo 8 páginas", "Abstract 300 palabras", "Propuesta de proyecto")
- indexing: Indexación ("Scopus Q1", "WoS", "Latindex", "IEEE Xplore", "No indexada", "N/A")

Responde SOLO con JSON válido. Sin markdown.`
        }
      ],
    });

    const raw = response.choices?.[0]?.message?.content || "[]";
    // Extract citations if available
    const citations = (response as unknown as { citations?: string[] }).citations || [];

    // Parse response
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);

    let opportunities: Record<string, unknown>[];
    try {
      opportunities = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON array from the response
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        opportunities = JSON.parse(escapeJsonControlChars(match[0]));
      } else {
        return NextResponse.json({ error: "No se pudo parsear la respuesta de Perplexity" }, { status: 500 });
      }
    }

    if (!Array.isArray(opportunities)) opportunities = [];

    // Filter: only keep entries with real URLs
    const validOpps = opportunities.filter(opp =>
      opp.url && String(opp.url).startsWith("http")
    );

    // Save to database
    const admin = createAdminClient();
    const toInsert = validOpps.map(opp => ({
      scan_date: today,
      name: String(opp.name || ""),
      type: scanType === "funds" ? "grant" : (opp.type || "conference"),
      organizer: opp.organizer || null,
      deadline: opp.deadline || null,
      event_date: opp.event_date || null,
      location: opp.location || null,
      url: String(opp.url),
      gloria_fit: opp.gloria_fit || "medium",
      advantages: opp.advantages || [],
      weaknesses: opp.weaknesses || [],
      approach: opp.approach || null,
      registration_cost: opp.registration_cost || null,
      gloria_fit_summary: opp.gloria_fit_summary || null,
      deliverable: opp.deliverable || null,
      indexing: opp.indexing || null,
      status: "new",
    }));

    if (toInsert.length > 0) {
      const { error: insertError } = await admin.from("research_opportunities").insert(toInsert);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Send email if requested
    if (sendEmail && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const highFit = validOpps.filter(o => o.gloria_fit === "high");
      const medFit = validOpps.filter(o => o.gloria_fit === "medium");
      const typeLabel = scanType === "funds" ? "Fondos" : "Congresos";

      const tableRows = validOpps.map(o => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; font-size: 13px;">
            <a href="${o.url}" style="color: #4A55A2; text-decoration: none; font-weight: bold;">${o.name}</a><br/>
            <span style="color: #888; font-size: 11px;">${o.organizer || ""} | ${o.location || ""}</span>
            ${o.deliverable ? `<br/><span style="color: #7c3aed; font-size: 10px; background: #f3e8ff; padding: 1px 6px; border-radius: 4px;">${o.deliverable}</span>` : ""}
          </td>
          <td style="padding: 10px; font-size: 12px; text-align: center;">
            <span style="background: ${o.gloria_fit === "high" ? "#dcfce7" : o.gloria_fit === "medium" ? "#fef3c7" : "#fee2e2"}; color: ${o.gloria_fit === "high" ? "#166534" : o.gloria_fit === "medium" ? "#92400e" : "#991b1b"}; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">
              ${o.gloria_fit === "high" ? "ALTA" : o.gloria_fit === "medium" ? "MEDIA" : "BAJA"}
            </span>
          </td>
          <td style="padding: 10px; font-size: 12px; color: #555;">${o.deadline || "Por confirmar"}</td>
          <td style="padding: 10px; font-size: 11px; color: #666;">
            ${o.registration_cost && o.registration_cost !== "A confirmar" ? `<strong>${o.registration_cost}</strong><br/>` : ""}
            ${String(o.gloria_fit_summary || "").substring(0, 100)}
          </td>
        </tr>
      `).join("");

      await resend.emails.send({
        from: "GlorIA Research <onboarding@resend.dev>",
        to: body.email || "tomas.despouy@ugm.cl",
        subject: `GlorIA — ${typeLabel}: ${highFit.length} alta, ${medFit.length} media (Perplexity)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: #4A55A2; padding: 20px 28px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">GlorIA — ${typeLabel}</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px;">
                ${today} | ${validOpps.length} oportunidades verificadas | Fuente: Perplexity Sonar
              </p>
            </div>
            <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
                <thead>
                  <tr style="background: #f0f0f5;">
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #666;">OPORTUNIDAD</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; color: #666;">AFINIDAD</th>
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #666;">DEADLINE</th>
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #666;">DETALLE</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
              ${citations.length > 0 ? `
                <p style="font-size: 10px; color: #999; margin-top: 16px;">
                  Fuentes: ${citations.slice(0, 5).map((c, i) => `<a href="${c}" style="color: #4A55A2;">[${i+1}]</a>`).join(" ")}
                </p>
              ` : ""}
            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      count: validOpps.length,
      citations: citations.slice(0, 10),
      opportunities: validOpps,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error en escaneo" }, { status: 500 });
  }
}

// GET — fetch saved opportunities
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("research_opportunities")
    .select("*")
    .order("scan_date", { ascending: false })
    .order("gloria_fit", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
