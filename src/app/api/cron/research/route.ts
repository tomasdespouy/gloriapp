/**
 * CRON: Research Scan — Triggered by Vercel Cron every ~2 weeks
 * Uses Perplexity Sonar for web-grounded search with real citations
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";

const GLORIA_CONTEXT = `GlorIA es una plataforma de entrenamiento clínico con IA para estudiantes de psicología.
Tecnologías: Motor adaptativo, RAG semántico, clasificador NLP, evaluación por competencias, WebSocket, dual model (GPT-4o-mini + GPT-4o).
Temas: IA en educación clínica, simulación de pacientes con LLM, evaluación de competencias, gamificación, NLP en terapia.`;

const NOTIFY_EMAIL = process.env.RESEARCH_NOTIFY_EMAIL || "tomas.despouy@ugm.cl";

function escapeJsonControlChars(raw: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && ch === "\n") { out += "\\n"; continue; }
    if (inStr && ch === "\r") { out += "\\r"; continue; }
    if (inStr && ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pplxKey = process.env.PERPLEXITY_API_KEY;
  if (!pplxKey) return NextResponse.json({ error: "PERPLEXITY_API_KEY no configurada" }, { status: 500 });

  try {
    const today = new Date().toISOString().split("T")[0];
    const pplx = new OpenAI({ apiKey: pplxKey, baseURL: "https://api.perplexity.ai" });

    // Search both conferences and funds in one call
    const response = await pplx.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: "Eres un investigador académico. Busca oportunidades REALES en la web. Responde SOLO con JSON válido. Todo en español."
        },
        {
          role: "user",
          content: `Hoy es ${today}. Busca 10-15 oportunidades REALES para GlorIA:
- 8-10 conferencias/journals/call-for-papers con deadlines próximos
- 3-5 fondos concursables (ANID, CORFO, internacionales)

${GLORIA_CONTEXT}

Para cada oportunidad devuelve JSON:
[{"name":"...","type":"conference|journal|call_for_papers|grant","organizer":"...","deadline":"YYYY-MM-DD","event_date":"...","location":"...","url":"URL real","gloria_fit":"high|medium|low","advantages":["..."],"weaknesses":["..."],"approach":"...","registration_cost":"...","gloria_fit_summary":"...","deliverable":"...","indexing":"..."}]

SOLO URLs reales. SOLO JSON. Sin markdown.`
        }
      ],
    });

    const raw = response.choices?.[0]?.message?.content || "[]";
    const citations = (response as unknown as { citations?: string[] }).citations || [];

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = escapeJsonControlChars(cleaned);

    let opportunities: Record<string, unknown>[];
    try {
      opportunities = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      opportunities = match ? JSON.parse(escapeJsonControlChars(match[0])) : [];
    }

    if (!Array.isArray(opportunities)) opportunities = [];
    const validOpps = opportunities.filter(o => o.url && String(o.url).startsWith("http"));

    const admin = createAdminClient();
    const toInsert = validOpps.map(opp => ({
      scan_date: today,
      name: String(opp.name || ""),
      type: opp.type || "conference",
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
      const { error } = await admin.from("research_opportunities").insert(toInsert);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send email
    if (process.env.RESEND_API_KEY && validOpps.length > 0) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const highFit = validOpps.filter(o => o.gloria_fit === "high");
      const grants = validOpps.filter(o => o.type === "grant");
      const confs = validOpps.filter(o => o.type !== "grant");

      const rows = validOpps.map(o => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-size: 12px;">
            <a href="${o.url}" style="color: #4A55A2; font-weight: bold; text-decoration: none;">${o.name}</a>
            <br/><span style="color: #999; font-size: 10px;">${o.organizer || ""}</span>
            ${o.deliverable ? `<br/><span style="background: #f3e8ff; color: #7c3aed; font-size: 9px; padding: 1px 5px; border-radius: 3px;">${o.deliverable}</span>` : ""}
          </td>
          <td style="padding: 8px; font-size: 11px; text-align: center;">
            <span style="background: ${o.gloria_fit === "high" ? "#dcfce7" : "#fef3c7"}; color: ${o.gloria_fit === "high" ? "#166534" : "#92400e"}; padding: 2px 6px; border-radius: 99px; font-size: 10px; font-weight: bold;">
              ${o.gloria_fit === "high" ? "ALTA" : o.gloria_fit === "medium" ? "MEDIA" : "BAJA"}
            </span>
          </td>
          <td style="padding: 8px; font-size: 11px; color: #555;">${o.deadline || "TBD"}</td>
        </tr>
      `).join("");

      await resend.emails.send({
        from: "GlorIA Research <noreply@glor-ia.com>",
        to: NOTIFY_EMAIL,
        subject: `[GlorIA] ${confs.length} congresos + ${grants.length} fondos (${highFit.length} alta afinidad)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <div style="background: #4A55A2; padding: 18px 24px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 18px;">Escaneo quincenal — Perplexity</h1>
              <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 12px;">${today} | ${validOpps.length} oportunidades</p>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
              <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #ddd; border-radius: 6px;">
                <thead><tr style="background: #f0f0f5;">
                  <th style="padding: 8px; text-align: left; font-size: 10px; color: #666;">OPORTUNIDAD</th>
                  <th style="padding: 8px; text-align: center; font-size: 10px; color: #666;">AFINIDAD</th>
                  <th style="padding: 8px; text-align: left; font-size: 10px; color: #666;">DEADLINE</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
              ${citations.length > 0 ? `<p style="font-size: 9px; color: #bbb; margin-top: 12px;">Fuentes: ${citations.slice(0, 5).join(", ")}</p>` : ""}
            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true, count: validOpps.length, citations: citations.slice(0, 10) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error cron" }, { status: 500 });
  }
}
