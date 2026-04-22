// Read-only audit script — no writes, no schema changes.
// Inspects the live remote DB via service role key to confirm the actual
// state of the surveys + survey_responses tables.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

console.log("════════════════════════════════════════════════════════════");
console.log("  SURVEYS AUDIT — live remote DB");
console.log("  URL:", url);
console.log("════════════════════════════════════════════════════════════\n");

// ─── 1. Check if form_version column exists by probing a SELECT ──────
console.log("1) Probing surveys.form_version column...");
const probeVersion = await sb.from("surveys").select("id, form_version").limit(1);
if (probeVersion.error) {
  console.log("   ❌ form_version column DOES NOT exist:", probeVersion.error.message);
} else {
  console.log("   ✅ form_version column EXISTS in remote DB");
}

console.log("\n2) Probing surveys.pilot_id column...");
const probePilot = await sb.from("surveys").select("id, pilot_id").limit(1);
if (probePilot.error) {
  console.log("   ❌ pilot_id column DOES NOT exist:", probePilot.error.message);
} else {
  console.log("   ✅ pilot_id column EXISTS");
}

console.log("\n3) Probing survey_responses.status column...");
const probeStatus = await sb.from("survey_responses").select("id, status").limit(1);
if (probeStatus.error) {
  console.log("   ❌ status column DOES NOT exist:", probeStatus.error.message);
} else {
  console.log("   ✅ status column EXISTS");
}

// ─── 4. Full survey inventory ─────────────────────────────────────────
console.log("\n4) Full surveys inventory (ALL rows, active+inactive):");
const { data: all, error: allErr } = await sb
  .from("surveys")
  .select("*")
  .order("created_at", { ascending: false });

if (allErr) {
  console.error("   Error:", allErr);
  process.exit(1);
}

console.log(`   Total surveys in DB: ${all.length}\n`);
for (const s of all) {
  const fv = s.form_version ?? "NULL(legacy-v1)";
  const pid = s.pilot_id ? s.pilot_id.slice(0, 8) + "…" : "null";
  const active = s.is_active ? "ACTIVE" : "inactive";
  const within = new Date(s.starts_at) <= new Date() && new Date() <= new Date(s.ends_at);
  console.log(
    `   · ${s.id.slice(0, 8)}…  ${active.padEnd(8)}  form=${String(fv).padEnd(16)}  pilot=${pid.padEnd(10)}  scope=${(s.scope_type || "null").padEnd(13)}  window_ok=${within}`,
  );
  console.log(`     title="${s.title}"`);
  console.log(`     window: ${s.starts_at} → ${s.ends_at}`);
}

// ─── 5. Active + within window (what the endpoint actually sees) ──────
console.log("\n5) Surveys that /api/surveys/active's initial query would return:");
const { data: live } = await sb
  .from("surveys")
  .select("*")
  .eq("is_active", true)
  .lte("starts_at", new Date().toISOString())
  .gte("ends_at", new Date().toISOString())
  .order("created_at", { ascending: false });
console.log(`   Count: ${live?.length ?? 0}`);
for (const s of live || []) {
  const fv = s.form_version ?? "NULL(legacy-v1)";
  const pid = s.pilot_id ? s.pilot_id.slice(0, 8) + "…" : "null";
  console.log(
    `   · ${s.id.slice(0, 8)}…  form=${String(fv).padEnd(16)}  pilot=${pid.padEnd(10)}  scope=${(s.scope_type || "null").padEnd(13)}  scope_id=${s.scope_id || "null"}`,
  );
  console.log(`     title="${s.title}"`);
}

// ─── 6. Pilots and their survey coverage ──────────────────────────────
console.log("\n6) Pilots vs surveys:");
const { data: pilots } = await sb
  .from("pilots")
  .select("id, name, institution, started_at, ended_at")
  .order("started_at", { ascending: false })
  .limit(20);
for (const p of pilots || []) {
  const pilotSurveys = (all || []).filter((s) => s.pilot_id === p.id);
  console.log(`   · ${p.id.slice(0, 8)}…  "${p.name}" (${p.institution})`);
  if (pilotSurveys.length === 0) {
    console.log(`       → NO pilot-scoped surveys`);
  } else {
    for (const s of pilotSurveys) {
      const fv = s.form_version ?? "NULL(legacy-v1)";
      console.log(
        `       → survey ${s.id.slice(0, 8)}…  active=${s.is_active}  form=${fv}  title="${s.title}"`,
      );
    }
  }
}

// ─── 7. Response counts per survey ────────────────────────────────────
console.log("\n7) Response counts per survey:");
for (const s of all || []) {
  const { count } = await sb
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", s.id);
  console.log(
    `   · ${s.id.slice(0, 8)}…  form=${s.form_version ?? "NULL"}  responses=${count ?? 0}  title="${s.title}"`,
  );
}

console.log("\n════════════════════════════════════════════════════════════");
console.log("  Audit complete — NO WRITES PERFORMED");
console.log("════════════════════════════════════════════════════════════");
