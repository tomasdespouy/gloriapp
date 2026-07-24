/** READ-ONLY: ¿por qué Resend envía correos a fnorrego@gmail.com? */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production"));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TARGET = (process.argv[2] || "fnorrego@gmail.com").toLowerCase();

(async () => {
  console.log("URL:", cfg.NEXT_PUBLIC_SUPABASE_URL);

  const { data: logs, error: le } = await s.from("email_log").select("*").ilike("recipient", `%${TARGET}%`).order("created_at", { ascending: false }).limit(60);
  console.log("\n=== email_log ===", le ? le.message : `${logs.length} filas`);
  (logs || []).forEach((l) => console.log(`  ${l.created_at} | ${l.type} | ok=${l.success} | ${l.recipient}`));

  const { data: prof, error: pe } = await s.from("profiles").select("*").ilike("email", `%${TARGET}%`);
  console.log("\n=== profiles ===", pe ? pe.message : `${prof.length} filas`);
  console.log(JSON.stringify(prof, null, 2));

  // auth.users
  const found = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.log("auth err:", error.message); break; }
    found.push(...data.users.filter((u) => (u.email || "").toLowerCase().includes(TARGET)));
    if (data.users.length < 1000) break;
  }
  console.log("\n=== auth.users ===");
  console.log(JSON.stringify(found.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, meta: u.user_metadata })), null, 2));

  // otras tablas con columnas de email
  for (const t of ["pilot_participants", "pilots", "crm_leads", "crm_contacts", "contact_submissions", "establishments", "courses", "course_sections"]) {
    const { data, error } = await s.from(t).select("*").limit(1);
    if (error) { console.log(`\n(tabla ${t}: ${error.message})`); continue; }
    const cols = data && data[0] ? Object.keys(data[0]) : [];
    for (const c of cols.filter((c) => c.toLowerCase().includes("email"))) {
      const { data: hits } = await s.from(t).select("*").ilike(c, `%${TARGET}%`);
      if (hits && hits.length) { console.log(`\n=== ${t}.${c} (${hits.length}) ===`); console.log(JSON.stringify(hits, null, 2)); }
    }
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
