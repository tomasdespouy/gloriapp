// READ-ONLY. Puntúa la "riqueza clínica" de cada paciente (0-100) según la
// rúbrica de 8 ejes. Es el baseline objetivo del antes/después.
// Uso: node scripts/score-richness.js [ruta-json]
const fs = require("fs");
const P = JSON.parse(fs.readFileSync(process.argv[2] || "scripts/patologias-export.json", "utf8"));

const RISK = /ideaci[oó]n|suicid|me quiero morir|no despertar|desaparecer|autolesi|cortar|cutting|viol(encia|ar|ó)|le peg|abus|sin plan|plan concreto/i;

function section(sp, startRe, endRe) {
  const re = new RegExp(startRe + "([\\s\\S]*?)(?=" + endRe + "|$)", "i");
  const m = (sp || "").match(re);
  return m ? m[1] : "";
}

function score(p) {
  const sp = p.system_prompt || "";
  const noRevela = section(sp, "LO QUE NO REVELA[S]?(?: F[AÁ]CILMENTE)?:", "REGLAS:");
  const b = {};

  // 1. presenting_problem multicapa (12)
  const pp = (p.presenting_problem || "").trim();
  const comps = pp.split(/[,;]| y (?=[a-záéíóú])/i).filter((x) => x.trim().length > 3);
  b.pp = pp.length < 12 ? 0 : comps.length >= 3 ? 12 : comps.length === 2 ? 8 : 3;

  // 2. backstory real, no autogenerado (8)
  const bs = (p.backstory || "").trim();
  b.bs = /generad[oa] autom/i.test(bs) ? 0 : bs.length > 120 ? 8 : bs.length > 40 ? 4 : 0;

  // 3. distinctive_factor (5)
  b.df = (p.distinctive_factor || "").trim().length > 10 ? 5 : 0;

  // 4. mecanismo de defensa explícito (15)
  b.def = /defens|deflect|minimiz|intelectualiz|sarcas|humor (negro|[áa]cido|como|para|evasiv)|racionaliz|fachada|m[aá]scara|armadura|cambia de tema|esquiv|justific|niega/i.test(sp) ? 15 : 0;

  // 5. gatillos condicionales apertura/cierre (20) — reactividad a la técnica
  const gat = (sp.match(/\bsi (el terapeuta|le |la |lo |te |alguien|sent[ií]s|sientes)\b/gi) || []).length;
  b.gat = gat >= 3 ? 20 : gat === 2 ? 14 : gat === 1 ? 7 : 0;

  // 6a. episodios concretos fechados (15)
  const fechado = /hace (un |dos |tres |cuatro |cinco |seis |\d+ )?(mes|meses|semana|semanas|a[ñn]o|a[ñn]os|d[ií]as)|cuando ten[ií]as? \d+|a los \d+ (a[ñn]os|tuyos)|la (semana|vez) pasad/i;
  b.epi = fechado.test(noRevela) ? 15 : fechado.test(sp) ? 8 : 0;

  // 6b. timing de sesión / alianza progresiva (10)
  b.tim = /sesi[oó]n \d\s*\+|sesi[oó]n [2-9]\+?|alianza (fuerte|s[oó]lida|muy fuerte)/i.test(sp) ? 10 : 0;

  // 7. capa de riesgo estructurada si aplica (5) — no penaliza a quien no aplica
  const aplicaRiesgo = RISK.test(sp) || RISK.test((p.tags || []).join(" "));
  b.rsk = !aplicaRiesgo ? 5 : /factor(es)? protector|no tienes plan|no hay plan|sin plan|no ten[eé]s plan|ideaci[oó]n pasiva|NO tienes|sin intenci/i.test(sp) ? 5 : 2;

  // 8. bloques enrichment (10) — 2.5 c/u
  const blocks = ["enrichment_red_social", "enrichment_lugares", "enrichment_estado_corporal", "enrichment_frases_tipo"];
  b.blq = blocks.reduce((s, k) => s + (p[k] && p[k].text ? 2.5 : 0), 0);

  const total = Object.values(b).reduce((a, c) => a + c, 0);
  return { total: Math.round(total), b, gat, aplicaRiesgo };
}

const rows = P.map((p) => ({ p, ...score(p) })).sort((a, b) => a.total - b.total);
console.log("RIQUEZA CLÍNICA (0-100) — de menor a mayor");
console.log("(pp=problema bs=backstory df=factor def=defensa gat=gatillos epi=episodios tim=timing rsk=riesgo blq=bloques)\n");
console.log("score | pp bs df def gat epi tim rsk blq | paciente");
for (const r of rows) {
  const b = r.b, f = (n, w) => String(n).padStart(w);
  const flag = r.total < 60 ? " ◄ bajo umbral" : "";
  console.log(`${f(r.total,4)}  | ${f(b.pp,2)} ${f(b.bs,2)} ${f(b.df,2)} ${f(b.def,3)} ${f(b.gat,3)} ${f(b.epi,3)} ${f(b.tim,3)} ${f(b.rsk,3)} ${f(b.blq,3)} | ${r.p.name} (${r.p.difficulty_level})${flag}`);
}
const avg = (rows.reduce((a, r) => a + r.total, 0) / rows.length).toFixed(0);
const under = rows.filter((r) => r.total < 60);
console.log(`\nPromedio: ${avg}/100 | Bajo umbral (<60): ${under.length} → ${under.map((r) => r.p.name).join(", ")}`);
