/**
 * Deep Research helpers — prompts, schema, parsing, email rendering.
 * Shared entre /api/cron/research, /api/cron/research/poll y /api/admin/research/scan.
 */
import OpenAI from "openai";
import { Resend } from "resend";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const DEFAULT_DEEP_RESEARCH_MODEL = "o4-mini-deep-research-2025-06-26";
export const DEFAULT_NOTIFY_EMAIL = "tomas.despouy@ugm.cl";
export const DEADLINE_WINDOW_DAYS = 45;

export const GLORIA_CONTEXT = `GlorIA es una plataforma web de entrenamiento clinico con IA para estudiantes de psicologia.

TECNOLOGIAS CLAVE:
- Motor adaptativo de estado clinico (5 variables, 14 reglas de transicion)
- Memory-Context Processing (MCP) para memoria persistente inter-sesion
- RAG semantico con pgvector
- Clasificador NLP de intervenciones terapeuticas (11 categorias)
- Evaluacion por competencias psicoterapeuticas (Valdes & Gomez 2023; 10 dimensiones, escala 0-4)
- Comunicacion bidireccional WebSocket (paciente reacciona en tiempo real)
- Pacientes con diversidad cultural latinoamericana (Chile, Colombia, Peru, Mexico, Argentina, RD)

LINEAS DE INVESTIGACION:
- IA generativa en educacion clinica
- Simulacion de pacientes con LLM
- Evaluacion automatica de competencias psicoterapeuticas
- RAG para coherencia clinica en agentes
- NLP aplicado a transcripciones de entrevistas
- Tecnologia educativa en salud mental
- Etica y validacion clinica de IA en formacion`;

export const DEEP_RESEARCH_SYSTEM = `Eres un investigador academico senior especializado en busquedas profundas. Tu mision es identificar oportunidades reales y verificables (congresos, journals, call-for-papers, fondos publicos y privados) donde un proyecto de IA aplicada a la formacion clinica en psicologia podria postular.

Reglas:
- Solo URLs oficiales verificadas en la web (no listas terceras ni agregadores).
- Solo deadlines vigentes y claramente publicados.
- Excluir oportunidades vencidas o que vencen mas alla de 60 dias.
- Cuando no encuentres un dato, declaralo como "no especificado" (no inventes).
- Para fondos: confirma que la convocatoria 2026/2027 esta abierta o tiene fecha de apertura confirmada.`;

export function buildResearchPrompt(today: string): string {
  return `Hoy es ${today}.

Realiza una investigacion profunda buscando 10-15 oportunidades reales y vigentes para GlorIA.

${GLORIA_CONTEXT}

OBJETIVOS:

1. CONFERENCIAS / JOURNALS / CALL-FOR-PAPERS con submission deadline en los proximos ${DEADLINE_WINDOW_DAYS}-60 dias:
   - IA en educacion: AIED, EDM, AAAI workshops, NeurIPS workshops, ICALT
   - EdTech: LAK, CSCL, L@S, EC-TEL
   - Psicologia clinica: APA, EFPA, SIP, WCBCT, EABCT, ALAPCO
   - NLP en salud: ACL workshops, EMNLP, NAACL, CL Psyche
   - Latinoamerica: CLEI, LACLO, congresos psicologia chilenos/latinoamericanos
   - Journals con special issues: JMIR Mental Health, JMIR Medical Education, Simulation in Healthcare,
     BMC Medical Education, Computers & Education, IEEE TLT, Frontiers in Psychiatry / Psychology

2. FONDOS / GRANTS con convocatoria abierta o que abre en proximos ${DEADLINE_WINDOW_DAYS}-60 dias:
   - ANID Chile: FONDECYT, Fondef IDeA, PIA, Anillos, Tesis Doctoral
   - CORFO Chile: Semilla, Crea y Valida, Prototipos de Innovacion
   - Mineduc Chile: fondos de innovacion docente
   - Internacionales: BID Lab, Banco Mundial, UNESCO, NIH, NSF
   - Fundaciones: Wellcome Trust, Gates Foundation, Google.org, Templeton
   - Programas UE: Horizon Europe, Erasmus+
   - Regionales: CONICET (AR), Colciencias/MinCiencias (CO), CONCYTEC (PE)

PARA CADA OPORTUNIDAD entrega un reporte en MARKDOWN con esta estructura:

### {nombre completo}
- **Tipo**: conference | journal | call_for_papers | grant
- **Organizador**: ...
- **Deadline**: YYYY-MM-DD
- **Fecha del evento**: ... (si aplica)
- **Ubicacion**: ... (si aplica)
- **URL oficial**: https://...
- **Costo de inscripcion / monto**: USD X / Gratuito / monto del fondo
- **Indexacion**: Scopus Q1 / WoS / IEEE / Latindex / N/A
- **Entregable**: paper 8 pgs / abstract 300 palabras / propuesta proyecto / etc.
- **Probabilidad estimada de aceptacion (0-100%)**: X%. Razones: ...
- **Dificultad de postulacion**: low | medium | high. Razones: ...
- **Fit con GlorIA (high|medium|low)**: ... Justificacion en 2-3 lineas.
- **Ventajas para GlorIA**: lista de 2-3 ventajas concretas
- **Desafios para GlorIA**: lista de 1-2 riesgos o gaps

Apunta a 10-15 oportunidades. CALIDAD sobre cantidad: mejor 8 oportunidades verificadas con URL oficial que 20 dudosas.`;
}

export const OpportunityZ = z.object({
  name: z.string(),
  type: z.enum(["conference", "journal", "call_for_papers", "grant"]),
  organizer: z.string().nullable(),
  deadline: z.string().nullable().describe("YYYY-MM-DD or null"),
  event_date: z.string().nullable(),
  location: z.string().nullable(),
  url: z.string(),
  gloria_fit: z.enum(["high", "medium", "low"]),
  gloria_fit_summary: z.string(),
  advantages: z.array(z.string()),
  weaknesses: z.array(z.string()),
  approach: z.string().nullable(),
  registration_cost: z.string().nullable(),
  deliverable: z.string().nullable(),
  indexing: z.string().nullable(),
  success_probability: z.number().int().min(0).max(100),
  probability_reason: z.string(),
  application_difficulty: z.enum(["low", "medium", "high"]),
  difficulty_reason: z.string(),
});

export const OpportunitiesEnvelopeZ = z.object({
  opportunities: z.array(OpportunityZ),
});

export type Opportunity = z.infer<typeof OpportunityZ>;

export type DeepResearchAnnotation = {
  type?: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
};

/**
 * Extrae el texto markdown del reporte y las anotaciones (citas) desde el output de Responses API.
 */
export function extractDeepResearchOutput(response: unknown): {
  text: string;
  annotations: DeepResearchAnnotation[];
} {
  const r = response as { output?: Array<Record<string, unknown>> };
  const output = Array.isArray(r.output) ? r.output : [];

  // Find the last item with content[0].text (final message)
  for (let i = output.length - 1; i >= 0; i--) {
    const item = output[i] as { type?: string; content?: Array<Record<string, unknown>> };
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      const blk = block as { type?: string; text?: string; annotations?: DeepResearchAnnotation[] };
      if (typeof blk.text === "string" && blk.text.length > 0) {
        return {
          text: blk.text,
          annotations: Array.isArray(blk.annotations) ? blk.annotations : [],
        };
      }
    }
  }
  return { text: "", annotations: [] };
}

/**
 * Segunda fase: convierte el reporte markdown de Deep Research en oportunidades estructuradas.
 * Usa gpt-4o-mini con structured outputs (Zod).
 */
export async function parseReportToOpportunities(
  openai: OpenAI,
  reportMarkdown: string,
  today: string
): Promise<Opportunity[]> {
  if (!reportMarkdown.trim()) return [];

  const completion = await openai.chat.completions.parse({
    model: process.env.OPENAI_RESEARCH_PARSER_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Eres un parser. Extraes oportunidades estructuradas de un reporte de investigacion academica en markdown.
Reglas:
- Solo extraer oportunidades con URL oficial valida (debe empezar con http).
- Excluir oportunidades vencidas (deadline anterior a ${today}).
- Si una oportunidad no tiene deadline claro, ponerla con deadline=null pero solo si la convocatoria parece estar abierta o por abrir.
- Convertir deadlines a formato YYYY-MM-DD cuando sea posible.
- Si la probabilidad o dificultad no aparece explicita, infierela del contexto del reporte.
- TODO el contenido textual debe quedar en espanol.`,
      },
      {
        role: "user",
        content: `Reporte de Deep Research:\n\n${reportMarkdown}`,
      },
    ],
    response_format: zodResponseFormat(OpportunitiesEnvelopeZ, "research_opportunities"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) return [];

  return parsed.opportunities.filter((o) => o.url && o.url.startsWith("http"));
}

/**
 * Score compuesto 0-9 (fit_w * prob * diff_w) — sirve para ordenar el digest.
 */
export function compositeScore(o: Opportunity): number {
  const fitW = { high: 3, medium: 2, low: 1 }[o.gloria_fit];
  const diffW = { low: 3, medium: 2, high: 1 }[o.application_difficulty];
  return fitW * (o.success_probability / 100) * diffW;
}

/**
 * Filtra oportunidades cuyo deadline cae dentro de la ventana de N dias.
 * Si deadline es null, las incluye (mejor pecar de inclusivo en fondos sin fecha exacta).
 */
export function filterByDeadlineWindow(
  opps: Opportunity[],
  today: Date,
  windowDays: number = DEADLINE_WINDOW_DAYS
): Opportunity[] {
  const cutoff = new Date(today.getTime() + windowDays * 86400000);
  return opps.filter((o) => {
    if (!o.deadline) return true;
    const d = new Date(o.deadline);
    if (isNaN(d.getTime())) return true;
    return d >= today && d <= cutoff;
  });
}

/**
 * Renderiza el HTML del email digest semanal.
 */
export function renderEmailHtml(args: {
  today: string;
  opps: Opportunity[];
  totalScanned: number;
  citations: DeepResearchAnnotation[];
  model: string;
  windowDays: number;
}): { subject: string; html: string } {
  const { today, opps, totalScanned, citations, model, windowDays } = args;

  const sorted = [...opps].sort((a, b) => compositeScore(b) - compositeScore(a));
  const high = sorted.filter((o) => o.gloria_fit === "high").length;
  const grants = sorted.filter((o) => o.type === "grant").length;
  const confs = sorted.length - grants;

  const fitBadge = (fit: Opportunity["gloria_fit"]) => {
    const map = {
      high: { bg: "#dcfce7", fg: "#166534", label: "ALTA" },
      medium: { bg: "#fef3c7", fg: "#92400e", label: "MEDIA" },
      low: { bg: "#fee2e2", fg: "#991b1b", label: "BAJA" },
    } as const;
    const m = map[fit];
    return `<span style="background:${m.bg};color:${m.fg};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:bold;">${m.label}</span>`;
  };

  const probBadge = (p: number) => {
    const color = p >= 60 ? "#166534" : p >= 30 ? "#92400e" : "#991b1b";
    const bg = p >= 60 ? "#dcfce7" : p >= 30 ? "#fef3c7" : "#fee2e2";
    return `<span style="background:${bg};color:${color};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:bold;">${p}%</span>`;
  };

  const diffBadge = (d: Opportunity["application_difficulty"]) => {
    const map = {
      low: { bg: "#dcfce7", fg: "#166534", label: "BAJA" },
      medium: { bg: "#fef3c7", fg: "#92400e", label: "MEDIA" },
      high: { bg: "#fee2e2", fg: "#991b1b", label: "ALTA" },
    } as const;
    const m = map[d];
    return `<span style="background:${m.bg};color:${m.fg};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:bold;">${m.label}</span>`;
  };

  const typeLabel = (t: Opportunity["type"]) =>
    ({ conference: "Congreso", journal: "Journal", call_for_papers: "Call for papers", grant: "Fondo" })[t];

  const rows = sorted
    .map(
      (o) => `
      <tr style="border-bottom: 1px solid #eee; vertical-align: top;">
        <td style="padding: 12px 10px; font-size: 13px;">
          <a href="${o.url}" style="color: #4A55A2; font-weight: bold; text-decoration: none;">${o.name}</a>
          <br/><span style="color: #999; font-size: 11px;">${o.organizer || ""}</span>
          <br/><span style="color: #4A55A2; font-size: 10px;">${typeLabel(o.type)}${o.indexing ? ` · ${o.indexing}` : ""}</span>
          ${o.deliverable ? `<br/><span style="background:#f3e8ff;color:#7c3aed;font-size:10px;padding:1px 6px;border-radius:4px;">${o.deliverable}</span>` : ""}
        </td>
        <td style="padding: 12px 10px; font-size: 12px; color: #555; white-space: nowrap;">${o.deadline || "Por confirmar"}</td>
        <td style="padding: 12px 10px; text-align: center;">${probBadge(o.success_probability)}</td>
        <td style="padding: 12px 10px; text-align: center;">${diffBadge(o.application_difficulty)}</td>
        <td style="padding: 12px 10px; text-align: center;">${fitBadge(o.gloria_fit)}</td>
        <td style="padding: 12px 10px; font-size: 11px; color: #555; max-width: 240px;">
          ${o.gloria_fit_summary || ""}
          ${o.registration_cost ? `<br/><span style="color:#7c3aed;font-size:10px;">Costo: ${o.registration_cost}</span>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const subject = `[GlorIA] ${sorted.length} oportunidades (${high} alta afinidad, vence en ${windowDays}d)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 960px; margin: 0 auto; background: #fafafa;">
      <div style="background: #4A55A2; padding: 22px 28px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Digest semanal de oportunidades</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px;">
          ${today} · ${confs} congresos/journals + ${grants} fondos · deadline ≤ ${windowDays} dias · escaneadas ${totalScanned} · modelo ${model}
        </p>
      </div>
      <div style="padding: 24px; background: white; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        ${
          sorted.length === 0
            ? `<p style="color:#666;">No se encontraron oportunidades que venzan en los proximos ${windowDays} dias. ${totalScanned} en total fueron escaneadas, todas con deadline mas alla de la ventana.</p>`
            : `<table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f0f0f5;">
                    <th style="padding: 10px; text-align: left; font-size: 10px; color: #666;">OPORTUNIDAD</th>
                    <th style="padding: 10px; text-align: left; font-size: 10px; color: #666;">DEADLINE</th>
                    <th style="padding: 10px; text-align: center; font-size: 10px; color: #666;">PROB.</th>
                    <th style="padding: 10px; text-align: center; font-size: 10px; color: #666;">DIFICULTAD</th>
                    <th style="padding: 10px; text-align: center; font-size: 10px; color: #666;">FIT</th>
                    <th style="padding: 10px; text-align: left; font-size: 10px; color: #666;">POR QUE APUNTAMOS</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>`
        }
        ${
          citations.length > 0
            ? `<div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #eee;">
                 <p style="font-size: 10px; color: #999; margin: 0 0 6px;">Fuentes citadas por Deep Research (top 8):</p>
                 <p style="font-size: 10px; color: #888; margin: 0;">${citations
                   .slice(0, 8)
                   .map((c, i) => (c.url ? `<a href="${c.url}" style="color:#4A55A2;">[${i + 1}] ${c.title || c.url}</a>` : ""))
                   .filter(Boolean)
                   .join(" · ")}</p>
               </div>`
            : ""
        }
      </div>
    </div>`;

  return { subject, html };
}

export async function sendDigestEmail(args: {
  resend: Resend;
  to: string;
  subject: string;
  html: string;
}): Promise<{ id?: string; error?: string }> {
  const { error, data } = await args.resend.emails.send({
    from: "GlorIA Research <noreply@glor-ia.com>",
    to: args.to,
    subject: args.subject,
    html: args.html,
  });
  if (error) return { error: typeof error === "string" ? error : JSON.stringify(error) };
  return { id: data?.id };
}
