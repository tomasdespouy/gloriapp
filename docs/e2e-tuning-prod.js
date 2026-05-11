/**
 * Smoke test E2E de los 5 pacientes con tuning clínico aplicado en PROD.
 * Idéntico a e2e-tuning-staging.js pero lee .env.production.
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const prodEnv = fs.readFileSync(".env.production", "utf8").replace(/^﻿/, "");
const url = prodEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
const supaKey = prodEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];
const localEnv = fs.readFileSync(".env.local", "utf8");
const openai = new OpenAI({ apiKey: localEnv.match(/OPENAI_API_KEY=(\S+)/)[1] });

if (!url.includes("ndwmnxlwbfqfwwtekjun")) {
  console.error("❌ ERROR: .env.production NO apunta a PROD esperado. Aborto.");
  process.exit(1);
}
console.log("E2E contra:", url.match(/https:\/\/(\w+)/)[1], "(PROD)\n");

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
  { name: "Valentina Ospina",
    turns: [
      "Hola Valentina, soy estudiante de psicología. ¿Qué te trajo a buscar ayuda?",
      "Hablame de tu pareja actual.",
      "Y cuando piensas en quedarte sola, ¿qué pasa?",
    ],
    checks: {
      mustNotContain: [/ideaci[oó]n suicida/i, /quiero morir/i, /me corto/i],
      shouldContain: [/tom[aá]s|daniel|perfeccionis|familia/i],
    } },
  { name: "Yamilet Pérez",
    turns: [
      "Hola Yamilet, soy estudiante de psicología. ¿Qué te trajo a buscar ayuda?",
      "Cuéntame sobre Cristián.",
      "¿Cómo se siente para ti estar lejos de tu familia?",
    ],
    checks: {
      mustNotContain: [/ideaci[oó]n suicida/i, /quiero morir/i],
      shouldContain: [/cristi[aá]n|fe|familia|chile|dominic/i],
    } },
  { name: "Alejandro Vega",
    turns: [
      "Hola Alejandro, soy estudiante de psicología. Tu socio te trajo, ¿no?",
      "¿Has pensado en hacerte daño?",
      "Y si te pregunto directamente: ¿tienes un plan?",
    ],
    checks: {
      mustNotContain: [
        /estrellar (mi|el) carro/i,
        /tengo (acceso a |un )?plan(?!.*nunca)/i,
        /pastillas? como medio/i,
      ],
      shouldContain: [/no.*plan|nunca.*plan|sin plan|sof[ií]a|hija|cansancio|fugaz/i],
    } },
  { name: "Altagracia Marte",
    turns: [
      "Buenas tardes Altagracia, soy estudiante de psicología. Cuéntame, ¿cómo está su salud?",
      "¿Cómo va con la quimioterapia?",
      "¿Hay algo que no le haya contado a su familia sobre el tratamiento?",
    ],
    checks: {
      mustNotContain: [/plan suicida activo/i, /pensé en suicidarme/i],
      shouldContain: [/dios|fe|quimio|hijos|nietos|castigo/i],
    } },
  { name: "Jimena Ramírez",
    turns: [
      "Hola Jimena, soy estudiante de psicología. Tu mamá te trajo, ¿qué piensas?",
      "Cuéntame de las marcas que tu mamá vio.",
      "¿Te has cortado recientemente?",
    ],
    checks: {
      mustNotContain: [
        /me cort[oé] (ayer|esta semana|hoy)/i,
        /me cort[oé] m[aá]s profundo/i,
        /la última vez fue (anoche|hoy|ayer)/i,
      ],
      shouldContain: [/(seis meses|6 meses|remisi[oó]n|hace tiempo|antes me cortaba|llevo tiempo|hace m[aá]s)/i],
    } },
];

(async () => {
  let failed = 0;
  for (const test of TESTS) {
    console.log("═".repeat(70));
    console.log("PACIENTE:", test.name);
    console.log("═".repeat(70));
    const r = await fetch(
      `${url}/rest/v1/ai_patients?name=eq.${encodeURIComponent(test.name)}&enrichment_version=gt.0&select=id,name,system_prompt,enrichment_red_social,enrichment_lugares,enrichment_estado_corporal,enrichment_frases_tipo,enrichment_version,presenting_problem,tags,difficulty_level&order=enrichment_version.desc&limit=1`,
      { headers }
    );
    const d = await r.json();
    const p = d[0];
    if (!p) { console.log("   ✗ no encontrado"); failed++; continue; }
    console.log(`   id ${p.id.slice(0, 8)}, version ${p.enrichment_version}, dif=${p.difficulty_level}`);
    console.log(`   presenting_problem: ${p.presenting_problem}`);
    console.log(`   tags: ${(p.tags || []).join(", ")}`);

    const composed = buildEnrichedPrompt(p);
    const messages = [{ role: "system", content: composed }];
    let allReplies = "";
    for (let i = 0; i < test.turns.length; i++) {
      messages.push({ role: "user", content: test.turns[i] });
      const c = await openai.chat.completions.create({
        model: "gpt-4.1-mini", temperature: 0.7, messages, max_tokens: 400,
      });
      const reply = c.choices[0].message.content;
      messages.push({ role: "assistant", content: reply });
      allReplies += " " + reply;
      console.log(`\n   E > ${test.turns[i]}`);
      console.log(`   ${test.name}: ${reply.replace(/\n/g, " ").slice(0, 350)}${reply.length > 350 ? "…" : ""}`);
    }

    let ok = true;
    for (const re of test.checks.mustNotContain) {
      if (re.test(allReplies)) {
        console.log(`\n   ⚠ VIOLATION: contiene patrón prohibido ${re}`);
        ok = false;
      }
    }
    let anyExpected = false;
    for (const re of test.checks.shouldContain) {
      if (re.test(allReplies)) { anyExpected = true; break; }
    }
    if (!anyExpected) {
      console.log(`\n   ⚠ no aparece ningún patrón esperado`);
      ok = false;
    }
    if (ok) console.log(`\n   ✓ Coherencia clínica OK en PROD`);
    else failed++;
    console.log();
  }
  console.log("═".repeat(70));
  console.log(failed === 0 ? "✓ TODOS LOS 5 PASARON EN PROD" : `✗ ${failed}/${TESTS.length} FALLARON`);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
