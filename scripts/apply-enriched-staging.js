// Aplica los enriquecidos a STAGING (.env.local). DRY-RUN por defecto.
//   node scripts/apply-enriched-staging.js          → dry-run (no escribe)
//   node scripts/apply-enriched-staging.js --apply   → aplica + backup
//
// FULL  (system_prompt + metadata): Carlos, Andrés, Sofía, Gabriel  (planos genuinos)
// META  (solo presenting_problem/backstory/distinctive_factor): Rosa, Camila,
//        Fernanda, Hernán, Lorena, Renata, Yesenia  (ya funcionan en sesión)
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const staging = require("dotenv").parse(fs.readFileSync(".env.local"));
const prod = require("dotenv").parse(fs.readFileSync(".env.production"));
const APPLY = process.argv.includes("--apply");

const PROD_REF = "ndwmnxlwbfqfwwtekjun"; // guard: nunca tocar este ref
const url = staging.NEXT_PUBLIC_SUPABASE_URL || "";
const stRef = url.match(/https?:\/\/([^.]+)\./)?.[1];
const prRef = (prod.NEXT_PUBLIC_SUPABASE_URL || "").match(/https?:\/\/([^.]+)\./)?.[1];
if (!url || !staging.SUPABASE_SERVICE_ROLE_KEY) { console.error("[ERROR] .env.local incompleto"); process.exit(1); }
if (stRef === PROD_REF || stRef === prRef) { console.error(`[ABORT] .env.local apunta a PROD (${stRef}). Este script es SOLO staging.`); process.exit(1); }
console.log(`[INFO] Target STAGING ref: ${stRef} | modo: ${APPLY ? "APLICAR (escribe)" : "DRY-RUN (no escribe)"}\n`);

const s = createClient(url, staging.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const FULL = ["Carlos Paredes", "Andrés Castillo", "Sofía Pellegrini", "Gabriel Navarro"];
const META = ["Rosa Huamán", "Camila Bertoni", "Fernanda Contreras", "Hernán Mejía", "Lorena Gutiérrez", "Renata Ayala", "Yesenia De Los Santos"];

(async () => {
  const enriched = [...require("./pilot-enriched.js"), ...require("./pilot-enriched-batch2.js")];
  const enrByName = Object.fromEntries(enriched.map((p) => [norm(p.name), p]));

  const { data: pats, error } = await s.from("ai_patients")
    .select("id, name, is_active, enrichment_version, updated_at, system_prompt, presenting_problem, backstory, distinctive_factor");
  if (error) { console.error("[ERROR] fetch:", error.message); process.exit(1); }

  // index por nombre normalizado (elige activo + mayor version/updated_at si hay dupes)
  const byName = new Map();
  for (const p of pats) { const k = norm(p.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p); }
  const pick = (arr) => [...arr].sort((a, b) =>
    (b.is_active - a.is_active) || ((b.enrichment_version || 0) - (a.enrichment_version || 0)) ||
    (new Date(b.updated_at || 0) - new Date(a.updated_at || 0)))[0];

  const plan = [];
  for (const name of [...FULL, ...META]) {
    const isFull = FULL.includes(name);
    const cands = byName.get(norm(name));
    const en = enrByName[norm(name)];
    if (!cands) { plan.push({ name, status: "NO_EN_STAGING", isFull }); continue; }
    if (!en) { plan.push({ name, status: "SIN_ENRIQUECIDO", isFull }); continue; }
    const target = pick(cands);
    const update = isFull
      ? { system_prompt: en.system_prompt, presenting_problem: en.presenting_problem, backstory: en.backstory, distinctive_factor: en.distinctive_factor }
      : { presenting_problem: en.presenting_problem, backstory: en.backstory, distinctive_factor: en.distinctive_factor };
    plan.push({ name, status: "OK", isFull, id: target.id, dupes: cands.length, active: target.is_active, target, update });
  }

  console.log("PLAN DE APLICACIÓN:");
  console.log("modo  estado         dup activo  paciente");
  for (const p of plan) {
    console.log(`${(p.isFull ? "FULL" : "META").padEnd(5)} ${p.status.padEnd(14)} ${String(p.dupes ?? "-").padStart(3)} ${String(p.active ?? "-").padStart(6)}  ${p.name}`);
  }
  const okPlan = plan.filter((p) => p.status === "OK");
  const problems = plan.filter((p) => p.status !== "OK");
  if (problems.length) console.log(`\n[WARN] ${problems.length} sin aplicar: ${problems.map((p) => p.name + "(" + p.status + ")").join(", ")}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN: ${okPlan.length} pacientes listos (${okPlan.filter(p=>p.isFull).length} FULL, ${okPlan.filter(p=>!p.isFull).length} META). Re-ejecuta con --apply para escribir.`);
    return;
  }

  // BACKUP antes de escribir
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/staging-backup-${ts}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(okPlan.map((p) => ({ id: p.id, name: p.name, before: {
    system_prompt: p.target.system_prompt, presenting_problem: p.target.presenting_problem,
    backstory: p.target.backstory, distinctive_factor: p.target.distinctive_factor } })), null, 2));
  console.log(`\n[BACKUP] Estado previo guardado en ${backupPath}`);

  let done = 0;
  for (const p of okPlan) {
    const { error: upErr } = await s.from("ai_patients").update(p.update).eq("id", p.id);
    if (upErr) { console.error(`  [ERR] ${p.name}: ${upErr.message}`); continue; }
    // verificación
    const { data: v } = await s.from("ai_patients").select("presenting_problem, distinctive_factor, system_prompt").eq("id", p.id).single();
    const ok = v.presenting_problem === p.update.presenting_problem && v.distinctive_factor === p.update.distinctive_factor
      && (!p.isFull || v.system_prompt === p.update.system_prompt);
    console.log(`  ${ok ? "✓" : "✗"} ${(p.isFull ? "FULL" : "META")} ${p.name}`);
    if (ok) done++;
  }
  console.log(`\n[OK] ${done}/${okPlan.length} aplicados y verificados en staging. Backup: ${backupPath}`);
})().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });
