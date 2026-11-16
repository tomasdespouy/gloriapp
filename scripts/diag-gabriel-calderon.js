// READ-ONLY: por qué Gabriel Calderón no puede entrar (PROD).
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  console.log("proyecto:", cfg.NEXT_PUBLIC_SUPABASE_URL);
  const { data: people, error } = await s
    .from("profiles")
    .select("*")
    .or("full_name.ilike.%calder%n%,email.ilike.%calder%n%");
  if (error) throw error;

  for (const p of people || []) {
    const { data: au } = await s.auth.admin.getUserById(p.id);
    const u = au?.user;
    console.log(`\n=== ${p.full_name} <${p.email}>  id=${p.id}`);
    console.log("  perfil:", JSON.stringify(p, null, 2));
    console.log(`  baneado en Auth=${u?.banned_until || "no"}  último ingreso=${u?.last_sign_in_at || "nunca"}  creado=${u?.created_at}`);

    const { data: parts, error: e2 } = await s.from("pilot_participants").select("*").eq("user_id", p.id);
    if (e2) console.log("  error pilot_participants:", e2.message);
    for (const pp of parts || []) {
      console.log("  participación:", JSON.stringify(pp));
      const { data: pilot } = await s.from("pilots").select("id, name, institution, status, scheduled_at, ended_at").eq("id", pp.pilot_id).single();
      console.log("  piloto:", JSON.stringify(pilot));
      const { count } = await s.from("pilot_participants").select("user_id", { count: "exact", head: true }).eq("pilot_id", pp.pilot_id);
      console.log(`  participantes en ese piloto: ${count}`);
    }
    if (!parts || parts.length === 0) console.log("  sin participación en pilotos");
  }
  if (!people || people.length === 0) console.log("Nadie coincide con 'calderón'.");
})().catch((e) => { console.error(e.message); process.exit(1); });
