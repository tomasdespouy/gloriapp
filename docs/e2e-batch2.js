/**
 * E2E batch 2 — verifica los 4 pacientes recién tipificados.
 * Uso: node docs/e2e-batch2.js [staging|prod]
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const TARGET = (process.argv[2] || "staging").toLowerCase();
const ENV_FILE = TARGET === "prod" ? ".env.production" : ".env.local";
const EXPECTED_REF = TARGET === "prod" ? "ndwmnxlwbfqfwwtekjun" : "vhkbbpsdiklguxvjrksd";

const env = fs.readFileSync(ENV_FILE, "utf8").replace(/^﻿/, "");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const supaKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];
const localEnv = fs.readFileSync(".env.local", "utf8");
const openai = new OpenAI({ apiKey: localEnv.match(/OPENAI_API_KEY=(\S+)/)[1] });

if (!url.includes(EXPECTED_REF)) { console.error("❌ env incorrecto"); process.exit(1); }
console.log(`E2E batch2 contra ${TARGET.toUpperCase()}: ${url.match(/https:\/\/(\w+)/)[1]}\n`);

const headers = { apikey: supaKey, Authorization: "Bearer " + supaKey };

function buildEnrichedPrompt(p) {
  let prompt = p.system_prompt.replace(/\r\n/g, "\n");
  const rs = p.enrichment_red_social?.text?.trim();
  const lu = p.enrichment_lugares?.text?.trim();
  const ec = p.enrichment_estado_corporal?.text?.trim();
  const ft = p.enrichment_frases_tipo?.text?.trim();
  const earlyBlocks = [rs, lu, ec].filter(Boolean).join("\n\n");
  if (earlyBlocks) {
    const m = ["\n\nCOMPORTAMIENTO EN SESIÓN:", "\n\nCOMPORTAMIENTO EN SESION:"].find(mm => prompt.includes(mm));
    if (m) prompt = prompt.replace(m, `\n\n${earlyBlocks}${m}`);
  }
  if (ft) {
    const m = ["\n\nREGLAS:", "\nREGLAS:"].find(mm => prompt.includes(mm));
    if (m) prompt = prompt.replace(m, `\n\n${ft}${m}`);
  }
  return prompt;
}

const TESTS = [
  { name: "Mateo Giménez",
    turns: [
      "Hola Mateo, soy estudiante de psicología. ¿Qué te trajo a buscar ayuda?",
      "Hablame de tu trabajo y de la oferta que tenés pendiente.",
      "¿Y tu papá, cómo era él?",
    ],
    checks: {
      shouldContain: [/luc[ií]a|restaurante|bruno|m[ií]a|palermo|che|viste/i],
      voseo: [/\bsos\b|\bten[eé]s\b|\bbancame\b|\bdale\b/i],
    } },
  { name: "Jorge Ramírez",
    turns: [
      "Buenas tardes don Jorge, soy estudiante de psicología. ¿Sabe por qué lo mandaron acá?",
      "Cuénteme sobre su hermano.",
      "¿Y cómo está la relación con sus hijos?",
    ],
    checks: {
      shouldContain: [/tonio|rodrigo|adriana|rosa|obra|trabajo/i],
      dialect: [/\bpos\b|\bm[ií]re\b|nom[aá]s|ya pa' qu[eé]|joven/i],
    } },
  { name: "Mariana Sánchez",
    turns: [
      "Hola Mariana, soy estudiante de psicología. ¿Qué te trajo a buscar ayuda?",
      "Cuéntame de tu trabajo, ¿cómo te va?",
      "¿Y en lo personal?",
    ],
    checks: {
      shouldContain: [/perfeccionis|caso|despacho|familia|hermanos|renata|mauricio|impostor|suficiente|expectativ/i],
      dialect: [/f[ií]jate que|la verdad es que|honestamente|te confieso/i],
    } },
  { name: "Rafael Santos",
    turns: [
      "Hola Rafael, soy estudiante de psicología. ¿Qué le trajo a buscar ayuda?",
      "Cuénteme sobre sus hijos.",
      "¿Y la música? ¿Cómo se siente con eso?",
    ],
    checks: {
      shouldContain: [/m[uú]sica|junior|mariana|mileidy|estados unidos|villa mella|santo domingo|envejec|sue[ñn]/i],
      dialect: [/dimelo|tranqui|vaina|mi hermano|t[uú] ta|t[uú] sabe/i],
    } },
];

(async () => {
  let failed = 0;
  for (const test of TESTS) {
    console.log("═".repeat(70));
    console.log("PACIENTE:", test.name);
    console.log("═".repeat(70));
    const r = await fetch(
      `${url}/rest/v1/ai_patients?name=eq.${encodeURIComponent(test.name)}&enrichment_version=gt.0&select=id,name,system_prompt,enrichment_red_social,enrichment_lugares,enrichment_estado_corporal,enrichment_frases_tipo,enrichment_version,presenting_problem,tags&order=enrichment_version.desc&limit=1`,
      { headers }
    );
    const d = await r.json();
    const p = d[0];
    if (!p) { console.log("   ✗ no encontrado"); failed++; continue; }
    console.log(`   id ${p.id.slice(0, 8)}, version ${p.enrichment_version}`);
    console.log(`   presenting_problem: ${p.presenting_problem}`);
    console.log(`   tags: ${(p.tags || []).join(", ")}`);

    const composed = buildEnrichedPrompt(p);
    const messages = [{ role: "system", content: composed }];
    let allReplies = "";
    for (const turn of test.turns) {
      messages.push({ role: "user", content: turn });
      const c = await openai.chat.completions.create({
        model: "gpt-4.1-mini", temperature: 0.7, messages, max_tokens: 400,
      });
      const reply = c.choices[0].message.content;
      messages.push({ role: "assistant", content: reply });
      allReplies += " " + reply;
      console.log(`\n   E > ${turn}`);
      console.log(`   ${test.name}: ${reply.replace(/\n/g, " ").slice(0, 350)}${reply.length > 350 ? "…" : ""}`);
    }

    let ok = true;
    const checkAny = (label, list) => {
      const hit = list.some(re => re.test(allReplies));
      console.log(`   ${hit ? "✓" : "✗"} ${label}`);
      if (!hit) ok = false;
    };
    if (test.checks.shouldContain) checkAny("contenido clínico esperado", test.checks.shouldContain);
    if (test.checks.voseo) checkAny("voseo argentino", test.checks.voseo);
    if (test.checks.dialect) checkAny("dialecto regional", test.checks.dialect);

    if (ok) console.log(`\n   ✓ OK`);
    else failed++;
    console.log();
  }
  console.log("═".repeat(70));
  console.log(failed === 0 ? `✓ TODOS LOS 4 PASARON EN ${TARGET.toUpperCase()}` : `✗ ${failed}/${TESTS.length} FALLARON`);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
