// READ-ONLY. Lee el JSON ya extraído y muestra, por paciente, el material
// "conversacional": cómo se manifiesta la patología al hablar.
const fs = require("fs");
const P = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8"));

// De un system_prompt, recorta las secciones que describen la conducta en sesión
// (personalidad, comportamiento, lo que no revela, defensas) y descarta las reglas.
const sliceBehavior = (sp) => {
  if (!sp) return "";
  const lines = sp.split(/\n/);
  const out = [];
  let keep = false;
  for (const ln of lines) {
    const t = ln.trim();
    if (/^(PERSONALIDAD|COMPORTAMIENTO|LO QUE NO REVELA|DEFENSA|EN SESI|RESISTENCIA|EVALUACION DE RIESGO|IMPORTANTE)/i.test(t)) keep = true;
    else if (/^(REGLAS|NUNCA|HISTORIA:|Responde SOLO|FORMATO)/i.test(t)) keep = false;
    if (keep && t) out.push(t);
  }
  return out.join("\n");
};

for (const p of P) {
  console.log(`\n========== ${p.name} (${p.difficulty_level}) — ${p.presenting_problem} ==========`);
  if (p.quote) console.log(`FRASE DE ENTRADA: "${p.quote}"`);
  if (p.personality_traits) console.log(`RASGOS: ${JSON.stringify(p.personality_traits)}`);
  const fr = p.enrichment_frases_tipo?.text;
  const ec = p.enrichment_estado_corporal?.text;
  if (fr) console.log(`\n— FRASES TÍPICAS:\n${fr.trim()}`);
  if (ec) console.log(`\n— ESTADO CORPORAL:\n${ec.trim()}`);
  const beh = sliceBehavior(p.system_prompt);
  if (beh) console.log(`\n— CONDUCTA EN SESIÓN (del prompt):\n${beh}`);
}
