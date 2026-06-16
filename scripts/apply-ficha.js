// Aplica SOLO-FICHA (distinctive_factor + pp/backstory si están) de un JSON a un
// entorno, sin tocar system_prompt. DRY-RUN por defecto.
//   node scripts/apply-ficha.js --env=.env.local                              → dry-run staging
//   node scripts/apply-ficha.js --env=.env.local --apply                       → aplica staging
//   node scripts/apply-ficha.js --env=.env.production --apply --prod-confirm    → aplica PROD
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const ENV_FILE = arg("env", ".env.local");
const FICHA = arg("ficha", "scripts/ficha-23.json");
const APPLY = process.argv.includes("--apply");
const PROD_REF = "ndwmnxlwbfqfwwtekjun";
const env = require("dotenv").parse(fs.readFileSync(ENV_FILE));
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
const isProd = ref === PROD_REF;
if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) { console.error(`[ERROR] ${ENV_FILE} incompleto`); process.exit(1); }
if (APPLY && isProd && !process.argv.includes("--prod-confirm")) { console.error("[ABORT] PROD exige --prod-confirm."); process.exit(1); }
console.log(`[INFO] Target: ${isProd ? "PRODUCCIÓN" : "staging/otro"} ref=${ref} | ficha=${FICHA} | modo: ${APPLY ? "APLICAR" : "DRY-RUN"}\n`);

const s = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

(async () => {
  const fichas = JSON.parse(fs.readFileSync(FICHA, "utf8"));
  const { data: pats, error } = await s.from("ai_patients").select("id, name, is_active, enrichment_version, updated_at, presenting_problem, backstory, distinctive_factor");
  if (error) { console.error("[ERROR] fetch:", error.message); process.exit(1); }
  const byName = new Map();
  for (const p of pats) { const k = norm(p.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p); }
  const pick = (arr) => [...arr].sort((a, b) => (b.is_active - a.is_active) || ((b.enrichment_version || 0) - (a.enrichment_version || 0)) || (new Date(b.updated_at || 0) - new Date(a.updated_at || 0)))[0];

  const plan = [];
  for (const f of fichas) {
    const cands = byName.get(norm(f.name));
    if (!cands) { plan.push({ name: f.name, status: "NO_EN_DB" }); continue; }
    const target = pick(cands);
    const update = { distinctive_factor: f.distinctive_factor };
    if (f.presenting_problem) update.presenting_problem = f.presenting_problem;
    if (f.backstory) update.backstory = f.backstory;
    plan.push({ name: f.name, status: "OK", id: target.id, dupes: cands.length, fields: Object.keys(update), target, update });
  }

  console.log("PLAN (solo-ficha):\nestado     dup campos                              paciente");
  for (const p of plan) console.log(`${p.status.padEnd(10)} ${String(p.dupes ?? "-").padStart(3)} ${(p.fields || []).join(",").padEnd(38)} ${p.name}`);
  const ok = plan.filter((p) => p.status === "OK"), bad = plan.filter((p) => p.status !== "OK");
  if (bad.length) console.log(`\n[WARN] sin aplicar: ${bad.map((p) => p.name).join(", ")}`);
  if (!APPLY) { console.log(`\nDRY-RUN: ${ok.length} listos.`); return; }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/${isProd ? "prod" : "staging"}-ficha-backup-${ts}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(ok.map((p) => ({ id: p.id, name: p.name, before: { presenting_problem: p.target.presenting_problem, backstory: p.target.backstory, distinctive_factor: p.target.distinctive_factor } })), null, 2));
  console.log(`\n[BACKUP] ${backupPath}`);
  let done = 0;
  for (const p of ok) {
    const { error: e } = await s.from("ai_patients").update(p.update).eq("id", p.id);
    if (e) { console.error(`  [ERR] ${p.name}: ${e.message}`); continue; }
    const { data: v } = await s.from("ai_patients").select("distinctive_factor").eq("id", p.id).single();
    const good = v.distinctive_factor === p.update.distinctive_factor;
    console.log(`  ${good ? "✓" : "✗"} ${p.name}`); if (good) done++;
  }
  console.log(`\n[OK] ${done}/${ok.length} fichas aplicadas en ${isProd ? "PRODUCCIÓN" : "staging"}. Backup: ${backupPath}`);
})().catch((e) => { console.error("[FATAL]", e.message); process.exit(1); });
