/**
 * Smoke test del motor de retroalimentación V3.
 *
 * Ejecuta el flujo completo:
 *   1. Construye el EVALUATION_PROMPT (con rúbrica conductual inyectada)
 *   2. Manda una transcripción de prueba al LLM activo
 *   3. Normaliza el output (NA → null, evidence → array)
 *   4. Imprime la evaluación de forma legible
 *
 * Sin tocar Supabase. Sin endpoints. Solo motor + LLM.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/smoke-test-feedback-v3.ts
 */

import { chat } from "../src/lib/ai";
import {
  EVALUATION_PROMPT,
  buildUserMessage,
  normalizeEvaluation,
  activeModelLabel,
  type NormalizedEvaluation,
} from "../src/lib/evaluation-prompt";
import { COMPETENCY_LABELS_V2 } from "../src/lib/gamification";
import { COMPETENCY_INFO } from "../src/lib/competency-definitions";

// ─────────────────────────────────────────────────────────────────
// Transcripción de prueba
// ─────────────────────────────────────────────────────────────────
// Primera sesión con paciente que consulta por ansiedad.
// El terapeuta muestra un mix realista: escucha activa decente,
// poca exploración de contexto, encuadre incompleto, un momento
// emocional intenso manejado con racionalización (mal manejo de
// contención), motivo manifiesto recogido pero sin profundizar
// en latente, datos no-verbales mencionados por el paciente pero
// no integrados por el terapeuta.
//
// Se espera que el motor reporte:
//   - setting_terapeutico bajo (1-2): mencionó tiempo pero no
//     confidencialidad ni roles
//   - motivo_consulta: 2 (pregunta superficial, no profundiza)
//   - datos_contextuales: 0 o 1 (no pregunta por familia/trabajo)
//   - objetivos: NA (fase inicial)
//   - escucha_activa: 3 (refleja contenido + emoción varias veces)
//   - actitud_no_valorativa: 3 (mantiene neutralidad)
//   - optimismo: NA (no había momento donde fuera pertinente)
//   - presencia: 2-3
//   - conducta_no_verbal: 1 (paciente menciona suspiros, terapeuta
//     no los nombra)
//   - contencion_afectos: 1 (racionaliza ante el momento intenso)

const TRANSCRIPT = `
TERAPEUTA: Hola Carolina, tenemos cuarenta y cinco minutos. Cuéntame, ¿qué te trae hoy?

PACIENTE: Hola... eh, no sé, es que llevo varias semanas con mucha ansiedad. Como que me cuesta dormir, y en el trabajo no me puedo concentrar.

TERAPEUTA: Mucha ansiedad y problemas para dormir. ¿Desde cuándo te pasa esto?

PACIENTE: Hace como dos meses, más o menos. Después de que... bueno, después de que terminó una relación.

TERAPEUTA: Ya, entiendo que algo de esa relación está conectado con lo que sientes. ¿Quieres contarme un poco?

PACIENTE: *suspira* Es difícil. Estábamos juntos cinco años y de un día para otro él dijo que no podía más. Yo me siento como... no sé, como si no valiera nada.

TERAPEUTA: Es muy doloroso lo que describes. Cinco años son muchos, es comprensible que duela.

PACIENTE: *pausa larga* Sí, pero es que también pienso que tal vez tenía razón. A lo mejor sí soy difícil de querer. Mi mamá siempre me decía eso cuando chica.

TERAPEUTA: Entiendo. Bueno, pero hay que tratar de pensar en positivo. Cada persona es diferente y lo que dijo tu ex no necesariamente es verdad. ¿Has pensado en hacer cosas que te gusten, salir con amigos?

PACIENTE: Eh... sí, supongo. *vuelve a suspirar* Pero a veces siento que no tengo energía para nada. Me cuesta hasta levantarme.

TERAPEUTA: Y cuando te sientes así, ¿qué haces?

PACIENTE: Nada. Me quedo en la cama mirando el techo. A veces lloro, otras veces solo me quedo ahí.

TERAPEUTA: Te entiendo. Es una etapa difícil. ¿Y cómo es tu día a día con el trabajo?

PACIENTE: Mal. Trabajo en una oficina, soy contadora, y antes me iba súper bien. Ahora me equivoco en cosas básicas. Mi jefa ya me llamó la atención dos veces.

TERAPEUTA: Eso debe sumar a la ansiedad, claro. Mira, vamos a trabajar en esto. Lo que te recomiendo es que trates de hacer una rutina, hacer ejercicio, ver amigos. Eso ayuda mucho con la ansiedad.

PACIENTE: Sí, lo voy a intentar. Gracias.

TERAPEUTA: Bueno, se nos acaba el tiempo. ¿Te gustaría volver la próxima semana?

PACIENTE: Sí, sí, me gustaría.

TERAPEUTA: Perfecto. Nos vemos entonces.
`.trim();

// ─────────────────────────────────────────────────────────────────
// Renderizado
// ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<number | "NA", string> = {
  "NA": "No aplicaba",
  0: "OMITIDO (debió aplicar)",
  1: "Deficiente",
  2: "Básico",
  3: "Adecuado",
  4: "Excelente",
};

function bar(score: number | null, width = 20): string {
  if (score === null) return "─".repeat(width) + " (NA)";
  const filled = Math.round((score / 4) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function renderEvaluation(e: NormalizedEvaluation): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(78));
  lines.push("  RETROALIMENTACIÓN MOTOR V3 — Smoke Test");
  lines.push("═".repeat(78));
  lines.push("");
  lines.push(`  Modelo: ${activeModelLabel()}    Promedio general (V2): ${e.overall_score_v2.toFixed(2)} / 4.0`);
  lines.push("");
  lines.push("─".repeat(78));
  lines.push("  PUNTAJES POR COMPETENCIA");
  lines.push("─".repeat(78));

  const domains = ["estructura", "actitudes"] as const;
  for (const domain of domains) {
    lines.push("");
    lines.push(`  ${domain === "estructura" ? "ESTRUCTURA DE LA SESIÓN" : "ACTITUDES TERAPÉUTICAS"}`);
    lines.push("");
    const keys = (Object.entries(COMPETENCY_INFO) as [keyof typeof e.scores, typeof COMPETENCY_INFO[string]][])
      .filter(([, info]) => info.domain === domain)
      .map(([key]) => key);

    for (const key of keys) {
      const score = e.scores[key];
      const label = COMPETENCY_LABELS_V2[key] || key;
      const padded = label.padEnd(28);
      const display = score === null ? "  NA " : ` ${score.toFixed(1)}`;
      const tag = score === null ? "NA" : score;
      lines.push(`    ${padded} ${bar(score)} ${display}  ${LEVEL_LABELS[tag] || ""}`);

      if (score === null && e.na_justifications[key]) {
        lines.push(`    ${"".padEnd(28)} ↳ NA: ${e.na_justifications[key]}`);
      }
    }
  }

  lines.push("");
  lines.push("─".repeat(78));
  lines.push("  COMENTARIO IA");
  lines.push("─".repeat(78));
  lines.push("");
  for (const chunk of wrap(e.commentary, 74, "  ")) lines.push(chunk);

  lines.push("");
  lines.push("─".repeat(78));
  lines.push("  FORTALEZAS");
  lines.push("─".repeat(78));
  for (const s of e.strengths) {
    for (const chunk of wrap(`• ${s}`, 74, "  ")) lines.push(chunk);
  }

  lines.push("");
  lines.push("─".repeat(78));
  lines.push("  ÁREAS DE MEJORA");
  lines.push("─".repeat(78));
  for (const s of e.areas_to_improve) {
    for (const chunk of wrap(`• ${s}`, 74, "  ")) lines.push(chunk);
  }

  lines.push("");
  lines.push("─".repeat(78));
  lines.push("  EVIDENCIA TEXTUAL (con polaridad)");
  lines.push("─".repeat(78));

  for (const [key, list] of Object.entries(e.evidence) as [keyof typeof e.scores, typeof e.evidence[string]][]) {
    if (!list || list.length === 0) continue;
    const label = COMPETENCY_LABELS_V2[key] || key;
    lines.push("");
    lines.push(`  ▸ ${label}  (${list.length} cita${list.length > 1 ? "s" : ""})`);
    for (const ev of list) {
      const tag = ev.polarity === "fortaleza" ? "[+]" : "[-]";
      const turn = ev.turn !== undefined ? ` turno ${ev.turn}` : "";
      lines.push(`    ${tag}${turn} "${ev.quote}"`);
      if (ev.observation) {
        for (const chunk of wrap(ev.observation, 70, "        ")) lines.push(chunk);
      }
    }
  }

  lines.push("");
  lines.push("═".repeat(78));
  return lines.join("\n");
}

function wrap(text: string, width: number, indent: string): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = indent;
  for (const w of words) {
    if (line.length + w.length + 1 > width + indent.length) {
      out.push(line.trimEnd());
      line = indent + w + " ";
    } else {
      line += w + " ";
    }
  }
  if (line.trim().length > 0) out.push(line.trimEnd());
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n[smoke] Modelo activo: ${activeModelLabel()}`);
  console.log(`[smoke] Tamaño del prompt: ${EVALUATION_PROMPT.length} caracteres`);
  console.log(`[smoke] Tamaño del transcript: ${TRANSCRIPT.length} caracteres`);
  console.log(`[smoke] Llamando al LLM... (puede tardar 15-40s)\n`);

  const t0 = Date.now();
  const userMsg = buildUserMessage(TRANSCRIPT, { sessionNumber: 1 });
  console.log(`[smoke] User message (primeros 200 chars): ${userMsg.slice(0, 200)}...\n`);
  const raw = await chat(
    [{ role: "user", content: userMsg }],
    EVALUATION_PROMPT,
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`[smoke] Respuesta recibida en ${elapsed}s. Parseando...\n`);

  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[smoke] ERROR: el LLM no devolvió JSON válido.");
    console.error("[smoke] Output crudo:\n", raw.slice(0, 2000));
    throw err;
  }

  const evaluation = normalizeEvaluation(parsed);
  console.log(renderEvaluation(evaluation));

  console.log("\n[smoke] Output JSON crudo (para auditoría):");
  console.log(JSON.stringify(parsed, null, 2).slice(0, 4000));
  console.log("\n[smoke] Done.\n");
}

main().catch((err) => {
  console.error("\n[smoke] FAILED:", err);
  process.exit(1);
});
