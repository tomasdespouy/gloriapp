// Genera la FICHA (distinctive_factor + pp/backstory si son pobres) de los 23
// pacientes aún no enriquecidos. NO toca system_prompt. Output ficha-23.json.
// Uso: node scripts/gen-ficha.js
const fs = require("fs");
const OpenAI = require("openai");
const cfg = require("dotenv").parse(fs.readFileSync(".env.local"));
const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });
const EVAL_MODEL = cfg.OPENAI_EVAL_MODEL || cfg.OPENAI_MODEL || "gpt-4o";

const DONE = new Set(["Carlos Paredes", "Andrés Castillo", "Rosa Huamán", "Sofía Pellegrini", "Gabriel Navarro", "Camila Bertoni", "Fernanda Contreras", "Hernán Mejía", "Lorena Gutiérrez", "Renata Ayala", "Yesenia De Los Santos"].map((n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const SYSTEM = `Eres un psicólogo clínico que escribe fichas de pacientes simulados para entrenar terapeutas. Recibes el material de un paciente y produces:

1. distinctive_factor: UNA sola frase que capture el rasgo identitario que distingue a este paciente, integrando su conflicto nuclear y su mecanismo característico. Estilo conciso, clínico y evocador. Ejemplos del estándar:
   - "Único sostén económico de la familia; mide su valor por proveer y calla su miedo para no preocupar a su esposa."
   - "Hija de psicoanalista que habla 'en psicólogo' para no contactar lo que siente; teme que elegir su propia vida sea traicionar a su madre."
   - "Pastor desgarrado entre el amor a su hijo y una fe que lo condena; no puede pedir ayuda en el único lugar donde siempre la encontró, su iglesia."

2. presenting_problem: SOLO si el actual es pobre (una sola palabra o un solo componente), reescríbelo multicapa y clínico. Si ya es bueno, devuelve null.

3. backstory: SOLO si el actual dice "Generado automáticamente" o está casi vacío, escribe uno real de 3-4 frases coherente con el material. Si ya es bueno, devuelve null.

Respeta el género, la nacionalidad y los hechos del material. Español neutro con acentos correctos. Responde SOLO JSON:
{"distinctive_factor": "...", "presenting_problem": null|"...", "backstory": null|"..."}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gen(p) {
  const mat = `Nombre: ${p.name}\nEdad: ${p.age}\nOcupación: ${p.occupation}\nPaís: ${p.country_origin || ""}\nMotivo de consulta actual: ${p.presenting_problem || ""}\nBackstory actual: ${p.backstory || ""}\nTags: ${(p.tags || []).join(", ")}\n\nSystem prompt (para contexto):\n${(p.system_prompt || "").slice(0, 1800)}`;
  for (let a = 0; a <= 4; a++) {
    try {
      const resp = await openai.chat.completions.create({ model: EVAL_MODEL, temperature: 0.5, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: mat }] });
      return JSON.parse(resp.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);
    } catch (e) { if (a < 4 && (e?.status === 429 || e?.status >= 500)) { await sleep(2500 * (a + 1)); continue; } throw e; }
  }
}

(async () => {
  const P = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8")).filter((p) => !DONE.has(norm(p.name)));
  console.log(`Generando ficha de ${P.length} pacientes con ${EVAL_MODEL}...\n`);
  const out = [];
  for (const p of P) {
    const g = await gen(p);
    const rec = { name: p.name, distinctive_factor: g.distinctive_factor };
    if (g.presenting_problem) rec.presenting_problem = g.presenting_problem;
    if (g.backstory) rec.backstory = g.backstory;
    out.push(rec);
    const extra = [g.presenting_problem ? "pp✎" : "", g.backstory ? "bs✎" : ""].filter(Boolean).join(" ");
    console.log(`✓ ${p.name.padEnd(24)} ${extra}\n    ${g.distinctive_factor}`);
  }
  fs.writeFileSync("scripts/ficha-23.json", JSON.stringify(out, null, 2));
  console.log(`\n→ scripts/ficha-23.json (${out.length} fichas; ${out.filter((r) => r.presenting_problem).length} pp mejorados, ${out.filter((r) => r.backstory).length} backstory reescritos)`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
