// Devuelve el acceso a Gabriel Calderón Pizarro <gabriel.calderon@ugm.cl> (PROD).
//
// Causa: su cuenta sigue vinculada al piloto «Piloto 14 de abril Fernanda
// Orrego» (finalizado el 14-abr-2026). La ventana del piloto bloquea a los
// estudiantes participantes (src/app/(app)/layout.tsx) y lo manda a
// /piloto-cerrado.
//
// Arreglo: se desvincula la cuenta de la fila de participante (user_id = null).
// La fila se conserva como registro histórico del piloto; no se borra la
// cuenta ni ninguna conversación, y los otros 16 participantes no cambian.
// Sin vínculo a un piloto, la cuenta deja de tener ventana de acceso.
//
// NO usar el botón "quitar participante" del panel: ese borra la cuenta.
//
// Revertir: update pilot_participants set user_id = USER_ID where id = PARTICIPANT_ID.
//
// Uso: node scripts/fix-gabriel-calderon-acceso.js          (solo muestra)
//      node scripts/fix-gabriel-calderon-acceso.js --apply  (aplica)
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PARTICIPANT_ID = "0f3afb0a-4cb3-495a-8839-8f2bd1506165";
const USER_ID = "7b135c9b-365a-4468-9682-1d9422e81625";
const PILOT_ID = "5810ab50-14f5-4ef1-9011-5fdd16e33391";
const EMAIL = "gabriel.calderon@ugm.cl";
const APPLY = process.argv.includes("--apply");

(async () => {
  console.log("proyecto:", cfg.NEXT_PUBLIC_SUPABASE_URL, APPLY ? "(APLICANDO)" : "(solo lectura)");

  const { data: row, error } = await s.from("pilot_participants").select("*").eq("id", PARTICIPANT_ID).single();
  if (error) throw error;
  console.log("fila antes:", JSON.stringify(row));

  if (row.user_id === null) {
    console.log("Ya estaba desvinculado; nada que hacer.");
  } else {
    if (row.user_id !== USER_ID || row.pilot_id !== PILOT_ID || row.email !== EMAIL) {
      throw new Error("La fila no coincide con lo esperado; no se toca nada.");
    }
    if (APPLY) {
      const { data: upd, error: e2 } = await s
        .from("pilot_participants")
        .update({ user_id: null })
        .eq("id", PARTICIPANT_ID)
        .eq("user_id", USER_ID)
        .select("id, user_id");
      if (e2) throw e2;
      console.log("actualizado:", JSON.stringify(upd));
    }
  }

  // Verificación: las tres puertas del layout.
  const { data: prof } = await s.from("profiles").select("role, is_disabled, must_change_password").eq("id", USER_ID).single();
  const { data: parts } = await s.from("pilot_participants").select("id, pilot_id").eq("user_id", USER_ID);
  const { data: au } = await s.auth.admin.getUserById(USER_ID);
  const { count } = await s.from("pilot_participants").select("id", { count: "exact", head: true }).eq("pilot_id", PILOT_ID);
  const { count: convs } = await s.from("conversations").select("id", { count: "exact", head: true }).eq("student_id", USER_ID);
  console.log("\nVERIFICACIÓN");
  console.log(`  is_disabled=${prof.is_disabled}  must_change_password=${prof.must_change_password}  rol=${prof.role}`);
  console.log(`  baneado en Auth=${au?.user?.banned_until || "no"}`);
  console.log(`  participaciones vinculadas a la cuenta=${(parts || []).length}`);
  console.log(`  filas del piloto (deben seguir siendo 17)=${count}`);
  console.log(`  conversaciones de la cuenta=${convs}`);
  const libre = !prof.is_disabled && !prof.must_change_password && (parts || []).length === 0 && !au?.user?.banned_until;
  console.log(libre ? "  → ACCESO LIBRE, sin ventana de piloto" : "  → SIGUE BLOQUEADO o pendiente de aplicar");
})().catch((e) => { console.error(e.message); process.exit(1); });
