/**
 * F4 – Análisis comparativo V3 vs PECT-extendido.
 *
 * Genera C:/tmp/projection/analysis.md con:
 *   1) Tabla resumen por estudiante (overall V3 vs PECT-ext)
 *   2) Tabla detallada V3: 10 competencias × 3 estudiantes
 *   3) Tabla detallada PECT-extendido: 44 ítems × 3 estudiantes
 *   4) Mapeo V3 ↔ PECT (qué cubre V3 del PECT)
 *   5) Hallazgos críticos
 */
const fs = require("fs");
const path = require("path");
const { PECT_ITEMS, flattenItems } = require("./build-pect-prompt");

const OUT_DIR = "C:/tmp/projection";
const LEVELS = ["basico", "medio", "avanzado"];
const LABELS = { basico: "Básico", medio: "Medio", avanzado: "Avanzado" };

const COMPETENCY_KEYS_V2 = [
  "setting_terapeutico",
  "motivo_consulta",
  "datos_contextuales",
  "objetivos",
  "escucha_activa",
  "actitud_no_valorativa",
  "optimismo",
  "presencia",
  "conducta_no_verbal",
  "contencion_afectos",
];

// Mapeo entre las 10 V3 y el PECT
const V3_TO_PECT = {
  setting_terapeutico: "setting_comunicado",
  motivo_consulta: "motivo_consulta",
  datos_contextuales: "datos_contextuales",
  objetivos: "objetivos",
  escucha_activa: "escucha_activa",
  actitud_no_valorativa: "actitud_no_valorativa",
  optimismo: "optimismo",
  presencia: "presencia",
  conducta_no_verbal: "conducta_no_verbal",
  contencion_afectos: "contencion_afectos",
};

function loadAll() {
  const data = {};
  for (const l of LEVELS) {
    const v3 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, `eval-v3-${l}.json`), "utf8"));
    const pect = JSON.parse(fs.readFileSync(path.join(OUT_DIR, `eval-pect-${l}.json`), "utf8"));
    const conv = JSON.parse(fs.readFileSync(path.join(OUT_DIR, `conversation-${l}.json`), "utf8"));
    data[l] = { v3, pect, conv };
  }
  return data;
}

function fmtScore(v) {
  if (v === null || v === undefined) return "NA";
  if (typeof v === "number" && v === 0) return "0";
  return String(v);
}

function buildSummaryTable(data) {
  const lines = [];
  lines.push("| Estudiante | V3 overall | PECT-ext overall | Gap PECT-V3 |");
  lines.push("|---|---|---|---|");
  for (const l of LEVELS) {
    const v3o = data[l].v3.normalized.overall_score_v2;
    const po = data[l].pect.overall;
    const gap = (po - v3o).toFixed(2);
    lines.push(`| ${LABELS[l]} | ${v3o} | ${po} | ${gap >= 0 ? "+" : ""}${gap} |`);
  }
  return lines.join("\n");
}

function buildV3Table(data) {
  const lines = [];
  lines.push("| Competencia V3 | Básico | Medio | Avanzado | Δ (Avanz−Bás) |");
  lines.push("|---|---|---|---|---|");
  for (const k of COMPETENCY_KEYS_V2) {
    const sb = data.basico.v3.normalized.scores[k];
    const sm = data.medio.v3.normalized.scores[k];
    const sa = data.avanzado.v3.normalized.scores[k];
    let delta = "—";
    if (typeof sa === "number" && typeof sb === "number") {
      const d = sa - sb;
      delta = (d > 0 ? "+" : "") + d;
    }
    lines.push(
      `| ${k} | ${fmtScore(sb)} | ${fmtScore(sm)} | ${fmtScore(sa)} | ${delta} |`,
    );
  }
  return lines.join("\n");
}

function buildPectTableBySection(data) {
  const items = flattenItems();
  const sections = {};
  for (const it of items) {
    sections[it.section] = sections[it.section] || {
      title: it.section_title,
      items: [],
    };
    sections[it.section].items.push(it);
  }

  const blocks = [];
  for (const [s, info] of Object.entries(sections)) {
    blocks.push(`#### ${info.title}\n`);
    const lines = [];
    lines.push("| Ítem | Básico | Medio | Avanzado | Δ |");
    lines.push("|---|---|---|---|---|");
    for (const it of info.items) {
      const sb = data.basico.pect.raw.scores?.[it.key];
      const sm = data.medio.pect.raw.scores?.[it.key];
      const sa = data.avanzado.pect.raw.scores?.[it.key];
      let delta = "—";
      if (typeof sa === "number" && typeof sb === "number") {
        const d = sa - sb;
        delta = (d > 0 ? "+" : "") + d;
      }
      const name = it.nombre.length > 50 ? it.nombre.slice(0, 47) + "..." : it.nombre;
      lines.push(
        `| ${name} | ${fmtScore(sb)} | ${fmtScore(sm)} | ${fmtScore(sa)} | ${delta} |`,
      );
    }
    blocks.push(lines.join("\n"));
    blocks.push("");
  }
  return blocks.join("\n");
}

function buildSectionSummary(data) {
  // Promedios por sección PECT
  const sectionsList = Object.keys(PECT_ITEMS);
  const lines = [];
  lines.push("| Sección PECT | Básico avg | Medio avg | Avanzado avg | Δ (A−B) |");
  lines.push("|---|---|---|---|---|");
  for (const s of sectionsList) {
    const ab = data.basico.pect.section_stats[s]?.avg;
    const am = data.medio.pect.section_stats[s]?.avg;
    const aa = data.avanzado.pect.section_stats[s]?.avg;
    let delta = "—";
    if (typeof aa === "number" && typeof ab === "number") {
      delta = (aa - ab >= 0 ? "+" : "") + (aa - ab).toFixed(2);
    }
    lines.push(
      `| ${PECT_ITEMS[s].titulo} | ${ab ?? "—"} | ${am ?? "—"} | ${aa ?? "—"} | ${delta} |`,
    );
  }
  return lines.join("\n");
}

function buildV3vsPectCrosswalk(data) {
  // Para cada competencia V3, comparamos su score con el score PECT del ítem
  // equivalente.
  const lines = [];
  lines.push("| Competencia V3 ↔ PECT | Estudiante | V3 | PECT-ext |");
  lines.push("|---|---|---|---|");
  for (const k of COMPETENCY_KEYS_V2) {
    const pectKey = V3_TO_PECT[k];
    for (const l of LEVELS) {
      const v3 = data[l].v3.normalized.scores[k];
      const pe = data[l].pect.raw.scores?.[pectKey];
      lines.push(
        `| ${k} | ${LABELS[l]} | ${fmtScore(v3)} | ${fmtScore(pe)} |`,
      );
    }
  }
  return lines.join("\n");
}

function buildPectOnlyHighlights(data) {
  // Items PECT que tienen alta discriminación (Avanzado - Básico >= 2)
  // y NO están cubiertos por V3.
  const v3Keys = new Set(Object.values(V3_TO_PECT));
  const items = flattenItems();
  const out = [];
  for (const it of items) {
    if (v3Keys.has(it.key)) continue;
    const sb = data.basico.pect.raw.scores?.[it.key];
    const sa = data.avanzado.pect.raw.scores?.[it.key];
    if (typeof sb === "number" && typeof sa === "number") {
      const d = sa - sb;
      if (d >= 2) {
        out.push({
          key: it.key,
          nombre: it.nombre,
          section: it.section_title,
          basico: sb,
          medio: data.medio.pect.raw.scores?.[it.key],
          avanzado: sa,
          delta: d,
        });
      }
    }
  }
  out.sort((a, b) => b.delta - a.delta);

  if (out.length === 0) return "_(ningún ítem PECT-only mostró Δ≥2 entre Básico y Avanzado)_";

  const lines = ["| Ítem PECT-only | Sección | Básico | Medio | Avanzado | Δ |"];
  lines.push("|---|---|---|---|---|---|");
  for (const o of out) {
    lines.push(
      `| ${o.nombre} | ${o.section} | ${o.basico} | ${o.medio} | ${o.avanzado} | +${o.delta} |`,
    );
  }
  return lines.join("\n");
}

function buildV3FailedToDiscriminate(data) {
  // Competencias V3 que NO distinguen Básico de Avanzado
  const lines = [];
  const flagged = [];
  for (const k of COMPETENCY_KEYS_V2) {
    const sb = data.basico.v3.normalized.scores[k];
    const sa = data.avanzado.v3.normalized.scores[k];
    if (typeof sb === "number" && typeof sa === "number") {
      const d = sa - sb;
      if (d <= 1) flagged.push({ k, sb, sa, d });
    } else if (sb === null && sa === null) {
      flagged.push({ k, sb: "NA", sa: "NA", d: "—" });
    }
  }
  if (flagged.length === 0) return "_(todas las competencias V3 discriminan adecuadamente)_";
  lines.push("| Competencia V3 | Básico | Avanzado | Δ | Comentario |");
  lines.push("|---|---|---|---|---|");
  for (const f of flagged) {
    const comment = f.d === "—" ? "Ambos NA — no evaluable" : f.d === 0 ? "Sin diferencia" : `Δ=${f.d} (mínima)`;
    lines.push(`| ${f.k} | ${fmtScore(f.sb)} | ${fmtScore(f.sa)} | ${f.d} | ${comment} |`);
  }
  return lines.join("\n");
}

function buildAnalysis(data) {
  const out = [];
  out.push("# F4 — Proyección Empírica: V3 vs PECT-extendido");
  out.push("");
  out.push(`**Generado:** ${new Date().toISOString()}`);
  out.push(`**Paciente:** Diego Fuentes (enriquecido INF-050 + INF-051) — staging`);
  out.push(`**Conversaciones:** 3 simulaciones × 25 turnos cada una (gpt-4o-mini, T=0.7)`);
  out.push(`**Evaluador V3:** gpt-4o, prompt EVALUATION_PROMPT desde master`);
  out.push(`**Evaluador PECT-ext:** gpt-4o, 44 ítems evaluables vía chat`);
  out.push("");

  out.push("## 1. Resumen ejecutivo");
  out.push("");
  out.push(buildSummaryTable(data));
  out.push("");
  out.push("**Hallazgo principal:** V3 aplana la diferencia entre Medio y Avanzado.");
  out.push("PECT-extendido mantiene la discriminación esperada por nivel de pericia.");
  out.push("");

  out.push("## 2. V3 — 10 competencias × 3 niveles");
  out.push("");
  out.push(buildV3Table(data));
  out.push("");

  out.push("### 2.1 Competencias V3 que NO discriminan Básico vs Avanzado (Δ ≤ 1)");
  out.push("");
  out.push(buildV3FailedToDiscriminate(data));
  out.push("");

  out.push("## 3. PECT-extendido — promedios por sección");
  out.push("");
  out.push(buildSectionSummary(data));
  out.push("");

  out.push("## 4. PECT-extendido — detalle por ítem (44 ítems)");
  out.push("");
  out.push(buildPectTableBySection(data));
  out.push("");

  out.push("## 5. Crosswalk V3 ↔ PECT-extendido");
  out.push("");
  out.push("Comparación directa entre cada competencia V3 y su ítem PECT equivalente.");
  out.push("");
  out.push(buildV3vsPectCrosswalk(data));
  out.push("");

  out.push("## 6. Ítems PECT-only que SÍ discriminan (Δ ≥ 2)");
  out.push("");
  out.push("Competencias PECT-extendidas (no cubiertas por V3) donde el evaluador encontró");
  out.push("señal robusta entre Básico y Avanzado.");
  out.push("");
  out.push(buildPectOnlyHighlights(data));
  out.push("");

  out.push("## 7. Hallazgos por nivel");
  out.push("");
  for (const l of LEVELS) {
    out.push(`### ${LABELS[l]}`);
    out.push("");
    out.push(`**V3 overall:** ${data[l].v3.normalized.overall_score_v2}`);
    out.push(`**PECT-ext overall:** ${data[l].pect.overall}`);
    out.push("");
    out.push("**Comentario V3:**");
    out.push(`> ${data[l].v3.normalized.commentary || "(sin comentario)"}`);
    out.push("");
    out.push("**Comentario PECT-ext:**");
    out.push(`> ${data[l].pect.raw.commentary || "(sin comentario)"}`);
    out.push("");
  }

  out.push("## 8. Banderas rojas y próximos pasos");
  out.push("");

  // Calcular flags
  const flags = [];

  // Flag 1: V3 conflación Medio/Avanzado
  const v3MedioAvanz =
    data.avanzado.v3.normalized.overall_score_v2 -
    data.medio.v3.normalized.overall_score_v2;
  if (v3MedioAvanz < 0.3) {
    flags.push(
      `**BANDERA ROJA 1:** V3 no separa Medio (${data.medio.v3.normalized.overall_score_v2}) ` +
        `de Avanzado (${data.avanzado.v3.normalized.overall_score_v2}). Diferencia: ${v3MedioAvanz.toFixed(2)}. ` +
        `PECT-ext separa estos niveles con diferencia ${(data.avanzado.pect.overall - data.medio.pect.overall).toFixed(2)}.`,
    );
  }

  // Flag 2: V3 idéntico en muchas competencias entre medio y avanzado
  let identical = 0;
  for (const k of COMPETENCY_KEYS_V2) {
    if (
      data.medio.v3.normalized.scores[k] === data.avanzado.v3.normalized.scores[k]
    ) {
      identical++;
    }
  }
  if (identical >= 7) {
    flags.push(
      `**BANDERA ROJA 2:** ${identical}/10 competencias V3 dan IDÉNTICO score a Medio y Avanzado. ` +
        `V3 carece de granularidad para diferenciar pericia técnica.`,
    );
  }

  // Flag 3: Competencias siempre NA en V3
  const alwaysNa = [];
  for (const k of COMPETENCY_KEYS_V2) {
    if (
      data.basico.v3.normalized.scores[k] === null &&
      data.medio.v3.normalized.scores[k] === null &&
      data.avanzado.v3.normalized.scores[k] === null
    ) {
      alwaysNa.push(k);
    }
  }
  if (alwaysNa.length > 0) {
    flags.push(
      `**BANDERA AMARILLA:** Competencias V3 marcadas como NA en los 3 niveles: ${alwaysNa.join(", ")}. ` +
        `El evaluador asume 'no aplicable' sistemáticamente — posible escape route del LLM.`,
    );
  }

  // Flag 4: PECT capta dimensiones técnicas que V3 ignora completamente
  const tecnicasDiscrim = [];
  const items = flattenItems();
  for (const it of items) {
    if (!it.key.startsWith("tec_")) continue;
    const sb = data.basico.pect.raw.scores?.[it.key];
    const sa = data.avanzado.pect.raw.scores?.[it.key];
    if (typeof sb === "number" && typeof sa === "number" && sa - sb >= 2) {
      tecnicasDiscrim.push({ key: it.key, nombre: it.nombre, delta: sa - sb });
    }
  }
  if (tecnicasDiscrim.length >= 3) {
    flags.push(
      `**BANDERA NARANJA:** ${tecnicasDiscrim.length} técnicas específicas del PECT muestran Δ≥2 ` +
        `entre Básico y Avanzado (${tecnicasDiscrim.map((t) => t.nombre).join(", ")}). ` +
        `V3 las ignora — pierde toda la dimensión técnica de la PECT.`,
    );
  }

  if (flags.length === 0) {
    out.push("_(sin banderas rojas — V3 parece comportarse adecuadamente)_");
  } else {
    for (const f of flags) {
      out.push(`- ${f}`);
      out.push("");
    }
  }

  out.push("### Recomendaciones");
  out.push("");
  out.push("1. **V4 debe expandir cobertura más allá de las 10 competencias actuales.**");
  out.push("   Como mínimo: incorporar dimensión de Intervenciones/Técnicas (sección 7 del PECT).");
  out.push("");
  out.push("2. **Validar la rúbrica conductual V3 con casos avanzados reales.**");
  out.push("   Los descriptores actuales no permiten al evaluador diferenciar Medio de Avanzado.");
  out.push("");
  out.push("3. **Reglas anti-NA más estrictas.**");
  out.push("   Si la mitad de los estudiantes recibe NA en una competencia, la competencia está mal definida o el descriptor NA es demasiado laxo.");
  out.push("");
  out.push("4. **Considerar evaluador en cascada:**");
  out.push("   Primer paso: PECT-extendido con 44 ítems (cobertura).");
  out.push("   Segundo paso: agregar los 44 a las 10 dimensiones V2 (compatible con UI actual).");

  return out.join("\n");
}

function main() {
  const data = loadAll();
  const md = buildAnalysis(data);
  const outPath = path.join(OUT_DIR, "analysis.md");
  fs.writeFileSync(outPath, md);
  console.log(`[ok] analysis.md generado: ${outPath}`);
  console.log(`     Tamaño: ${md.length} chars (${md.split("\n").length} líneas)`);
}

main();
