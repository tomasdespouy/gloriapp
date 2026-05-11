/**
 * Genera tabla descriptora clínica de los 34 pacientes.
 * Para cada uno: cuadro clínico, signos observables, defensa principal.
 *
 * Output: imprime markdown a stdout.
 * Datos derivados de: presenting_problem, tags, personality_traits.communication_style,
 * y para los casos donde el style no es informativo, se hace inferencia desde el backstory.
 */
const fs = require("fs");

const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/patients-clinical-summary.json", "utf8"));

// Mapeo communication_style → comportamiento observable + defensa
const STYLE_MAP = {
  // ─ Estilos del seed original (5 pacientes legacy)
  "guarded_but_willing": ["Cauta inicialmente, se disculpa al emocionarse", "Negación parcial, autodisculpa"],
  "deflects_with_humor": ["Esquiva con humor (\"yo no estoy loco\")", "Humor evitativo"],
  "monosyllabic_initially": ["Monosilábico al inicio; silencios largos; \"no sé\" frecuente", "Aislamiento, retracción"],
  "articulate_and_challenging": ["Articulada, desafiante, pone a prueba al terapeuta", "Intelectualización, control"],
  "formal_and_brief": ["Formal y factual; \"Bien, gracias, doctor\"; evita emociones", "Formación reactiva, distanciamiento"],
  // ─ Estilos del batch de 18 (intermedios)
  "anxious_but_open": ["Habla rápido cuando ansiosa, autoexigente, llanto fácil con autodisculpa", "Perfeccionismo, autocrítica"],
  "factual_and_flat": ["Tono plano, no nombra emociones, responde con datos", "Alexitimia, racionalización"],
  "uses_clinical_jargon": ["Intelectualiza con jerga clínica para no sentir", "Intelectualización extrema"],
  "submissive_and_justifying": ["Minimiza la situación, justifica al agresor", "Minimización, identificación con agresor"],
  "monosyllabic": ["Hombre de pocas palabras, distante, no se queja", "Negación, masculinidad rígida"],
  "articulate_but_trapped": ["Articulada y paralizada; ambivalente entre cambio y miedo", "Ambivalencia, sumisión"],
  "fragmented_when_triggered": ["Habla fluida hasta que el trauma aparece; ahí se fragmenta", "Disociación, evitación"],
  "moderate_facade": ["Fachada alegre, dice \"estoy bien\" automático", "Negación maníaca, sobreadaptación"],
  "cheerful_surface": ["Fachada alegre que se quiebra con validación genuina", "Negación maníaca, sobreadaptación"],
  "high_ambivalent": ["Quiere ayuda y la teme al mismo tiempo", "Ambivalencia paralizante, escisión"],
  // ─ Estilos del batch nuevo (los 11 que faltaban en staging)
  "insightful_but_stuck": ["Tiene insight (\"sé que esto no está bien\") pero no logra actuar", "Racionalización, parálisis afectiva"],
  "self_aware_but_stuck": ["Conoce su patrón, lo describe, no logra cambiarlo", "Intelectualización defensiva"],
  "cauteloso": ["Cauteloso al inicio; se abre con escucha sin juicio", "Evitación, contención"],
  "direct_and_colloquial": ["Directo, coloquial, lenguaje de la calle", "Negación masculina, humor"],
  "cynical_and_articulate": ["Cínico, sarcástico, articulado; ataca al setting", "Sarcasmo, racionalización"],
  "sarcastic_defense": ["Sarcasmo como escudo; \"da igual, no importa\"", "Sarcasmo defensivo"],
  "emotional_and_narrative": ["Cuenta historias largas, se desborda emocionalmente", "Somatización, narrativa rumiativa"],
  "religious_framework": ["Encuadra todo en términos religiosos; \"es voluntad de Dios\"", "Resignación espiritual, sublimación"],
  "quiet_and_hesitant": ["Voz baja, dudosa, pide permiso para hablar", "Inhibición, sumisión"],
  "storytelling": ["Narra anécdotas como evitación de emoción presente", "Distanciamiento narrativo"],
  "formal_and_measured": ["Formal y medido; \"don\" / \"señor\"; sopesa cada palabra", "Formación reactiva, contención"],
};

// Inferencia secundaria para pacientes con communication_style faltante o muy genérico
function inferFromTagsAndProblem(tags, problem, presenting) {
  const t = (tags || []).join(" ").toLowerCase();
  const p = (presenting || "").toLowerCase();
  if (/duelo/.test(t + p)) return ["Habla del fallecido en presente, dificultad para llorar", "Negación, idealización"];
  if (/p[aá]nico|ansiedad/.test(t + p)) return ["Hipervigilancia, taquicardia narrada, \"siento que me muero\"", "Evitación, hipercontrol"];
  if (/burnout/.test(t + p)) return ["Agotamiento físico, cinismo, \"no doy más\"", "Sobreadaptación al rol cuidador"];
  if (/trauma|ptsd|estr[eé]s post/.test(t + p)) return ["Sobresaltos, evitación de gatillos, fragmentos del relato", "Disociación, evitación"];
  if (/codepende|violencia/.test(t + p)) return ["Justifica al agresor, baja autoestima, autoinculpa", "Identificación con agresor"];
  if (/depresi[oó]n/.test(t + p)) return ["Anhedonia, enlentecimiento, \"no me dan ganas\"", "Inhibición, retraimiento"];
  if (/identidad|crisis/.test(t + p)) return ["Cuestionamiento existencial, \"¿quién soy ahora?\"", "Disonancia, búsqueda"];
  if (/familia|paterno|conflicto/.test(t + p)) return ["Resentimiento contenido, lealtades en conflicto", "Represión, lealtades inconscientes"];
  if (/aislamiento/.test(t + p)) return ["Retraimiento social, evitación de contacto", "Evitación, retracción"];
  if (/autoestima/.test(t + p)) return ["Autocrítica constante, comparaciones desfavorables", "Autoexigencia, devaluación"];
  if (/ira/.test(t + p)) return ["Reactividad, rumiación hostil, dificultad de pausa", "Externalización, racionalización"];
  return ["—", "—"];
}

function clinicalCategoryFromTags(tags, presenting) {
  const tagSet = new Set((tags || []).map((t) => t.toLowerCase()));
  if (tagSet.has("trauma") || /trauma|ptsd/.test((presenting || "").toLowerCase())) return "Trauma / TEPT";
  if (tagSet.has("duelo")) return "Duelo";
  if (tagSet.has("ideacion") || tagSet.has("ideación") || /ideaci[oó]n suicida/.test((presenting || "").toLowerCase())) return "Riesgo / Depresión grave";
  if (tagSet.has("ansiedad") || /p[aá]nico|ansiedad/.test((presenting || "").toLowerCase())) return "Ansiedad";
  if (tagSet.has("depresion") || tagSet.has("depresión") || /depresi[oó]n/.test((presenting || "").toLowerCase())) return "Depresión";
  if (/burnout/.test((presenting || "").toLowerCase())) return "Burnout";
  if (tagSet.has("personalidad")) return "Rasgos de personalidad";
  if (tagSet.has("familia") || tagSet.has("dependencia")) return "Vínculos / Familia";
  if (tagSet.has("pareja")) return "Relación de pareja";
  if (tagSet.has("identidad") || tagSet.has("adaptación")) return "Identidad / Crisis vital";
  if (tagSet.has("autoestima")) return "Autoestima";
  if (tagSet.has("masculinidad")) return "Masculinidad / Duelo";
  return "Otro";
}

const lines = [];
lines.push("| # | Paciente | Edad | País | Dif. | Cuadro clínico | Cómo se manifiesta (signos observables) | Defensa principal |");
lines.push("|---|---|---|---|---|---|---|---|");

for (let i = 0; i < PATIENTS.length; i++) {
  const p = PATIENTS[i];
  const country = Array.isArray(p.country) ? p.country[0] : p.country;
  const cs = p.personality_traits?.communication_style;
  let [signs, defense] = STYLE_MAP[cs] || ["", ""];

  // Si no hay descripción del style, inferir desde tags
  if (!signs || signs === "—") {
    [signs, defense] = inferFromTagsAndProblem(p.tags, p.tags?.join(" ") || "", p.presenting_problem);
  }

  // Para "cauteloso" (genérico), enriquecer con la inferencia del cuadro
  if (cs === "cauteloso") {
    const [extra, extraDef] = inferFromTagsAndProblem(p.tags, p.tags?.join(" ") || "", p.presenting_problem);
    if (extra && extra !== "—") {
      signs = `Cauteloso al inicio; ${extra.toLowerCase()}`;
      defense = extraDef !== "—" ? extraDef : defense;
    }
  }

  const cuadro = clinicalCategoryFromTags(p.tags, p.presenting_problem);
  const consulta = (p.presenting_problem || "").length > 70
    ? p.presenting_problem.slice(0, 70) + "…"
    : p.presenting_problem || "";

  lines.push(
    `| ${i + 1} | **${p.name}** | ${p.age} | ${country} | ${p.difficulty_level} | ${cuadro} <br/><sub>${consulta}</sub> | ${signs} | ${defense} |`
  );
}

console.log(lines.join("\n"));
