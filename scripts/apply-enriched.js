// Aplica los enriquecidos a un entorno. DRY-RUN por defecto.
//   node scripts/apply-enriched.js --env=.env.local                         → dry-run staging
//   node scripts/apply-enriched.js --env=.env.local --apply                  → aplica staging
//   node scripts/apply-enriched.js --env=.env.production                     → dry-run PROD
//   node scripts/apply-enriched.js --env=.env.production --apply --prod-confirm → aplica PROD
//
// FULL (system_prompt + metadata): Carlos, Andrés, Sofía, Gabriel
// META (presenting_problem/backstory/distinctive_factor): Rosa, Camila, Fernanda,
//       Hernán, Lorena, Renata, Yesenia
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const ENV_FILE = arg("env", ".env.local");
const APPLY = process.argv.includes("--apply");
const PROD_CONFIRM = process.argv.includes("--prod-confirm");
const PROD_REF = "ndwmnxlwbfqfwwtekjun";

const env = require("dotenv").parse(fs.readFileSync(ENV_FILE));
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error(`[ERROR] ${ENV_FILE} incompleto`); process.exit(1); }
const isProd = ref === PROD_REF;
console.log(`[INFO] Target: ${isProd ? "PRODUCCIÓN" : "staging/otro"} ref=${ref} (${ENV_FILE}) | modo: ${APPLY ? "APLICAR" : "DRY-RUN"}`);
if (APPLY && isProd && !PROD_CONFIRM) { console.error("[ABORT] Escribir en PRODUCCIÓN exige también --prod-confirm."); process.exit(1); }
console.log();

const s = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FULL = ["Carlos Paredes", "Andrés Castillo", "Sofía Pellegrini", "Gabriel Navarro"];
const META = ["Rosa Huamán", "Camila Bertoni", "Fernanda Contreras", "Hernán Mejía", "Lorena Gutiérrez", "Renata Ayala", "Yesenia De Los Santos"];

(async () => {
  const enriched = [...require("./pilot-enriched.js"), ...require("./pilot-enriched-batch2.js")];
  const enrByName = Object.fromEntries(enriched.map((p) => [norm(p.name), p]));
  const { data: pats, error } = await s.from("ai_patients")
    .select("id, name, is_active, enrichment_version, updated_at, system_prompt, presenting_problem, backstory, distinctive_factor");
  if (error) { console.error("[ERROR] fetch:", error.message); process.exit(1); }

  const byName = new Map();
  for (const p of pats) { const k = norm(p.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p); }
  const pick = (arr) => [...arr].sort((a, b) => (b.is_active - a.is_active) || ((b.enrichment_version || 0) - (a.enrichment_version || 0)) || (new Date(b.updated_at || 0) - new Date(a.updated_at || 0)))[0];

  const plan = [];
  for (const name of [...FULL, ...META]) {
    const isFull = FULL.includes(name);
    const cands = byName.get(norm(name)), en = enrByName[norm(name)];
    if (!cands) { plan.push({ name, status: "NO_EN_DB", isFull }); continue; }
    if (!en) { plan.push({ name, status: "SIN_ENRIQUECIDO", isFull }); continue; }
    const target = pick(cands);
    const update = isFull
      ? { system_prompt: en.system_prompt, presenting_problem: en.presenting_problem, backstory: en.backstory, distinctive_factor: en.distinctive_factor }
      : { presenting_problem: en.presenting_problem, backstory: en.backstory, distinctive_factor: en.distinctive_factor };
    plan.push({ name, status: "OK", isFull, id: target.id, dupes: cands.length, active: target.is_active, target, update });
  }

  console.log("PLAN:\nmodo  estado         dup activo  paciente");
  for (const p of plan) console.log(`${(p.isFull ? "FULL" : "META").padEnd(5)} ${p.status.padEnd(14)} ${String(p.dupes ?? "-").padStart(3)} ${String(p.active ?? "-").padStart(6)}  ${p.name}`);
  const okPlan = plan.filter((p) => p.status === "OK");
  const problems = plan.filter((p) => p.status !== "OK");
  if (problems.length) console.log(`\n[WARN] sin aplicar: ${problems.map((p) => p.name + "(" + p.status + ")").join(", ")}`);

  if (!APPLY) { console.log(`\nDRY-RUN: ${okPlan.length} listos (${okPlan.filter((p) => p.isFull).length} FULL, ${okPlan.filter((p) => !p.isFull).length} META).`); return; }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/${isProd ? "prod" : "staging"}-backup-${ts}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(okPlan.map((p) => ({ id: p.id, name: p.name, before: { system_prompt: p.target.system_prompt, presenting_problem: p.target.presenting_problem, backstory: p.target.backstory, distinctive_factor: p.target.distinctive_factor } })), null, 2));
  console.log(`\n[BACKUP] ${backupPath}`);

  let done = 0;
  for (const p of okPlan) {
    const { error: upErr } = await s.from("ai_patients").update(p.update).eq("id", p.id);
    if (upErr) { console.error(`  [ERR] ${p.name}: ${upErr.message}`); continue; }
    const { data: v } = await s.from("ai_patients").select("presenting_problem, distinctive_factor, system_prompt").eq("id", p.id).single();
    const ok = v.presenting_problem === p.update.presenting_problem && v.distinctive_factor === p.update.distinctive_factor && (!p.isFull || v.system_prompt === p.update.system_prompt);
    console.log(`  ${ok ? "✓" : "✗"} ${p.isFull ? "FULL" : "META"} ${p.name}`); if (ok) done++;
  }
  console.log(`\n[OK] ${done}/${okPlan.length} aplicados y verificados en ${isProd ? "PRODUCCIÓN" : "staging"}. Backup: ${backupPath}`);
})().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });
