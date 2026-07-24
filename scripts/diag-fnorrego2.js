/** READ-ONLY: alcance de Fernanda Orrego (fnorrego@gmail.com) y volumen de correos. */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production"));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EST = "a974a2f1-f9d6-4482-b3a2-bba30eb22615";
const EST_META = "08d440c6-ea33-4552-90af-78ad98bbd31c";
const PILOT = "5810ab50-14f5-4ef1-9011-5fdd16e33391";
const EMAIL = "fnorrego@gmail.com";

(async () => {
  // columnas de email_log
  const { data: sample } = await s.from("email_log").select("*").limit(1);
  console.log("email_log cols:", sample && sample[0] ? Object.keys(sample[0]) : "(vacía)");
  if (sample && sample[0]) {
    const tsCol = Object.keys(sample[0]).find((c) => /at$|date|time/.test(c)) || "id";
    const { data: logs } = await s.from("email_log").select("*").eq("recipient", EMAIL).order(tsCol, { ascending: false }).limit(40);
    console.log(`\nemail_log para ${EMAIL}: ${logs ? logs.length : 0}`);
    (logs || []).forEach((l) => console.log("  ", JSON.stringify(l)));
    const { count } = await s.from("email_log").select("*", { count: "exact", head: true }).eq("recipient", EMAIL);
    console.log("  total histórico:", count);
  }

  for (const id of [EST, EST_META]) {
    const { data: e } = await s.from("establishments").select("*").eq("id", id).maybeSingle();
    console.log(`\nestablishment ${id}:`, JSON.stringify(e));
  }

  const { data: p } = await s.from("pilots").select("*").eq("id", PILOT).maybeSingle();
  console.log("\npiloto:", JSON.stringify(p, null, 2));

  // Cuántos estudiantes en el establecimiento de su perfil
  const { data: studs } = await s.from("profiles").select("id, full_name, email, role, section_id, course_id, is_disabled").eq("establishment_id", EST);
  console.log(`\nPerfiles en establecimiento ${EST}: ${studs ? studs.length : 0}`);
  const byRole = {};
  (studs || []).forEach((u) => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
  console.log("  por rol:", JSON.stringify(byRole));
  (studs || []).filter((u) => u.role !== "student").forEach((u) => console.log(`  [${u.role}] ${u.full_name} <${u.email}> sec=${u.section_id} course=${u.course_id} disabled=${u.is_disabled}`));

  // Sesiones completadas recientes de estudiantes de ese establecimiento
  const studentIds = (studs || []).filter((u) => u.role === "student").map((u) => u.id);
  if (studentIds.length) {
    const { data: convs } = await s.from("conversations").select("id, student_id, status, created_at, completed_at").in("student_id", studentIds).eq("status", "completed").order("created_at", { ascending: false }).limit(20);
    console.log(`\nÚltimas sesiones completadas del establecimiento: ${convs ? convs.length : 0}`);
    (convs || []).forEach((c) => console.log(`  ${c.completed_at || c.created_at} | ${c.student_id}`));
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
