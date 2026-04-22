// Read-only: shows how pilot times are stored (UTC) vs the server
// clock vs the local "es-CL" representation, so we can sanity-check
// the timezone pipeline.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const now = new Date();
console.log("THIS MACHINE:");
console.log(`  now() raw:         ${now.toISOString()}`);
console.log(`  now() en-CL:       ${now.toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false, dateStyle: "short", timeStyle: "medium" })}`);
console.log(`  TZ offset:         UTC${now.getTimezoneOffset() > 0 ? "-" : "+"}${String(Math.abs(now.getTimezoneOffset()/60)).padStart(2,"0")}`);
console.log();

// Ask Postgres for its now() — this is what Supabase DB uses for TIMESTAMPTZ comparisons.
// No RPC exists by default; fall back to inserting/reading a DB-generated timestamp.
// We probe by reading a pilots row with its updated_at and comparing.
const { data: sample } = await sb.from("pilots")
  .select("id, name, scheduled_at, ended_at, status, created_at, updated_at")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("SAMPLE PILOTS (stored as UTC in DB, converted below):");
for (const p of sample || []) {
  console.log(`\n  ${p.name} [${p.status}]`);
  console.log(`    scheduled_at raw UTC:  ${p.scheduled_at || "—"}`);
  if (p.scheduled_at) {
    const d = new Date(p.scheduled_at);
    console.log(`    → en Santiago:         ${d.toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`);
    const diffMs = d.getTime() - Date.now();
    const diffHrs = (diffMs / 3600000).toFixed(1);
    console.log(`    → vs now(): ${diffMs > 0 ? `en ${diffHrs}h` : `hace ${Math.abs(Number(diffHrs))}h`}`);
  }
  console.log(`    ended_at raw UTC:      ${p.ended_at || "—"}`);
  if (p.ended_at) {
    const d = new Date(p.ended_at);
    console.log(`    → en Santiago:         ${d.toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`);
    const diffMs = d.getTime() - Date.now();
    const diffHrs = (diffMs / 3600000).toFixed(1);
    console.log(`    → vs now(): ${diffMs > 0 ? `en ${diffHrs}h` : `hace ${Math.abs(Number(diffHrs))}h`}`);
  }
}

console.log("\n─ UBO pilot (looking up) ─");
const { data: ubo } = await sb.from("pilots")
  .select("*")
  .ilike("name", "%Universidad Bernardo%")
  .limit(5);
for (const p of ubo || []) {
  console.log(`  ${p.id}  ${p.name}`);
  console.log(`    institution:  ${p.institution}`);
  console.log(`    status:       ${p.status}`);
  console.log(`    scheduled_at: ${p.scheduled_at || "—"}`);
  console.log(`    ended_at:     ${p.ended_at || "—"}`);
}
