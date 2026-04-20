// Read-only diagnostic: walks through /api/surveys/active logic step by
// step for a given user email and explains exactly which filter (if any)
// is blocking the survey from appearing.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/diagnose-user-survey.mjs <email>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log(`════════════════════════════════════════════════════════════`);
console.log(`  SURVEY DIAGNOSTIC — ${email}`);
console.log(`════════════════════════════════════════════════════════════\n`);

// 1. Resolve user
const { data: authUsers } = await sb.auth.admin.listUsers();
const authUser = authUsers?.users?.find((u) => u.email === email);
if (!authUser) {
  console.log("❌ No auth user found with that email.");
  process.exit(0);
}
console.log(`1) Auth user found: id=${authUser.id}  created=${authUser.created_at}`);

const { data: profile } = await sb.from("profiles").select("id, role, establishment_id, course_id, section_id, full_name").eq("id", authUser.id).single();
if (!profile) {
  console.log("❌ No profile row for this user.");
  process.exit(0);
}
console.log(`   profile: role=${profile.role}  establishment=${profile.establishment_id || "—"}  name="${profile.full_name}"`);

// Filter 1: admin/superadmin
if (profile.role === "admin" || profile.role === "superadmin") {
  console.log(`\n❌ BLOCKED: role is '${profile.role}' — endpoint skips all surveys for admins/superadmins.`);
  process.exit(0);
}

// Filter 2: gate on completed sessions
const { count: completed } = await sb.from("conversations")
  .select("id", { count: "exact", head: true })
  .eq("student_id", authUser.id)
  .eq("status", "completed");
console.log(`\n2) Completed conversations (status='completed'): ${completed ?? 0}`);
if (!completed || completed < 1) {
  console.log(`   ❌ BLOCKED by gate: endpoint requires >=1 completed session. This is the most likely reason.`);
  console.log(`      → User must open a patient chat and press "Finalizar" at least once.`);
} else {
  console.log(`   ✅ Gate passed.`);
}

// Pilot membership — query via service_role to see the truth
const { data: pilotRows } = await sb.from("pilot_participants").select("pilot_id, pilot:pilots(id,name,institution)").eq("user_id", authUser.id);
console.log(`\n3) Pilot memberships (service_role, ignores RLS): ${pilotRows?.length ?? 0}`);
for (const r of pilotRows || []) {
  const p = r.pilot;
  console.log(`   · ${r.pilot_id.slice(0,8)}… "${p?.name}" (${p?.institution})`);
}
const userPilotIds = new Set((pilotRows || []).map((r) => r.pilot_id));

// Also query with the authenticated user's own session to detect RLS gaps.
// /api/surveys/active runs queries under the user's JWT — if RLS blocks the
// user from seeing their own pilot_participants row, the endpoint silently
// treats them as "not in any pilot" and all pilot-scoped surveys disappear.
try {
  const { data: link } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await anon.auth.verifyOtp({ type: link?.properties?.email_otp_type || "magiclink", token_hash: link?.properties?.hashed_token });
  const { data: authedPilotRows } = await anon.from("pilot_participants").select("pilot_id").eq("user_id", authUser.id);
  const authedCount = authedPilotRows?.length ?? 0;
  console.log(`   RLS check — same query as authenticated user: ${authedCount} row(s)`);
  if (authedCount !== (pilotRows?.length ?? 0)) {
    console.log(`   ⚠️  RLS MISMATCH: service_role sees ${pilotRows?.length ?? 0} but authenticated user sees ${authedCount}. pilot_participants RLS is blocking the user — endpoint will treat them as non-pilot.`);
  }
} catch (e) {
  console.log(`   (RLS check failed: ${e.message})`);
}

// Active surveys
const { data: surveys } = await sb.from("surveys").select("*").eq("is_active", true)
  .lte("starts_at", new Date().toISOString()).gte("ends_at", new Date().toISOString());
console.log(`\n4) Active surveys in window: ${surveys?.length ?? 0}`);
for (const s of surveys || []) {
  console.log(`   · ${s.id.slice(0,8)}…  form=${s.form_version ?? "NULL"}  pilot=${s.pilot_id ? s.pilot_id.slice(0,8)+"…" : "null"}  scope=${s.scope_type}  scope_id=${s.scope_id || "null"}  title="${s.title}"`);
}

// Responses already given
const { data: responses } = await sb.from("survey_responses").select("survey_id, status").eq("user_id", authUser.id);
const respondedIds = new Set((responses || []).map((r) => r.survey_id));
console.log(`\n5) Surveys already responded/declined: ${respondedIds.size}`);
for (const r of responses || []) console.log(`   · ${r.survey_id.slice(0,8)}…  status=${r.status}`);

// Walk through applicable filter step by step
console.log(`\n6) Simulating /api/surveys/active filter per survey:`);
const appl = [];
for (const s of surveys || []) {
  const tag = s.id.slice(0,8)+"…";
  if (respondedIds.has(s.id)) { console.log(`   · ${tag}: SKIP — already responded`); continue; }
  if (s.form_version !== "v2_pilot") { console.log(`   · ${tag}: SKIP — form_version='${s.form_version}' (legacy filter rejects non-v2)`); continue; }
  if (s.pilot_id) {
    if (!userPilotIds.has(s.pilot_id)) { console.log(`   · ${tag}: SKIP — pilot_id=${s.pilot_id.slice(0,8)}… not in user's pilots`); continue; }
    console.log(`   · ${tag}: ✅ APPLICABLE (user is member of pilot ${s.pilot_id.slice(0,8)}…)`);
    appl.push(s);
    continue;
  }
  // Non-pilot scopes
  let ok = false;
  if (s.scope_type === "global") ok = true;
  else if (s.scope_type === "establishment" && s.scope_id === profile.establishment_id) ok = true;
  else if (s.scope_type === "course" && s.scope_id === profile.course_id) ok = true;
  else if (s.scope_type === "section" && s.scope_id === profile.section_id) ok = true;
  console.log(`   · ${tag}: ${ok ? "✅ APPLICABLE" : "SKIP — scope mismatch"} (scope=${s.scope_type}/${s.scope_id}, user=${profile.establishment_id})`);
  if (ok) appl.push(s);
}

console.log(`\n7) FINAL: endpoint would return ${appl.length} survey(s).`);
for (const s of appl) console.log(`   → "${s.title}" (form=${s.form_version})`);

if (appl.length === 0) {
  console.log(`\n💡 This user will NOT see any survey modal until one of the blockers above is resolved.`);
}
