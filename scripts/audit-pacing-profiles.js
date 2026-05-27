/**
 * Auditoría READ-ONLY de los perfiles de pacing de los pacientes IA y del
 * turno en que cada arquetipo pregunta el nombre del terapeuta.
 *
 * Responde la pregunta: ¿por qué no todos los pacientes preguntan el nombre
 * en la 3era interacción? -> porque `askNameAtTurn` depende del arquetipo
 * (pacing_profile), no es un valor fijo. Ver src/lib/conversation-pacing.ts.
 *
 * READ-ONLY. Nunca escribe a la base.
 * Uso: node scripts/audit-pacing-profiles.js
 */
const ENV_FILE = process.argv[2] || ".env.local";
require("dotenv").config({ path: ENV_FILE });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\./)?.[1] || "(unknown)";
console.log(`[INFO] Proyecto Supabase: ${projectRef}`);
console.log(`[INFO] Modo: READ-ONLY\n`);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Turno en que cada arquetipo pregunta el nombre (espejo de
// src/lib/conversation-pacing.ts -> introductionProtocol.askNameAtTurn).
// NULL en la base cae a 'conversational_medium' en runtime (getPacingProfile).
const ASK_TURN = {
  anxious_fast: 2,
  conversational_medium: 3,
  reflective_paused: 4,
  depressive_slow: 5,
  inhibited_timid: 6,
};
const DEFAULT_PROFILE = "conversational_medium";

function effectiveProfile(p) {
  return p && ASK_TURN[p] ? p : DEFAULT_PROFILE;
}

(async () => {
  const { data, error } = await supabase
    .from("ai_patients")
    .select("id, name, age, difficulty_level, pacing_profile, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[ERROR] Consulta falló:", error.message);
    process.exit(1);
  }

  const activos = data.filter((p) => p.is_active);

  // ── Tabla por paciente ───────────────────────────────────────────
  console.log(`PACIENTES (${data.length} total, ${activos.length} activos)\n`);
  const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
  console.log(
    pad("Nombre", 26) + pad("Edad", 6) + pad("Dificultad", 14) +
    pad("Perfil (DB)", 24) + pad("Turno nombre", 13) + "Activo"
  );
  console.log("-".repeat(95));
  for (const p of data) {
    const eff = effectiveProfile(p.pacing_profile);
    const turno = ASK_TURN[eff];
    const perfilCol = p.pacing_profile
      ? p.pacing_profile
      : `(null→${DEFAULT_PROFILE})`;
    console.log(
      pad(p.name, 26) + pad(p.age, 6) + pad(p.difficulty_level, 14) +
      pad(perfilCol, 24) + pad(`turno ${turno}`, 13) + (p.is_active ? "sí" : "no")
    );
  }

  // ── Resumen de distribución (solo activos) ───────────────────────
  console.log(`\n\nDISTRIBUCIÓN POR PERFIL (solo ${activos.length} activos)\n`);
  const byProfile = {};
  for (const p of activos) {
    const eff = effectiveProfile(p.pacing_profile);
    const key = p.pacing_profile ? eff : `${eff} (incl. null)`;
    byProfile[key] = byProfile[key] || { count: 0, turno: ASK_TURN[eff] };
    byProfile[key].count++;
  }
  const rows = Object.entries(byProfile).sort((a, b) => a[1].turno - b[1].turno);
  for (const [key, { count, turno }] of rows) {
    const bar = "█".repeat(count);
    console.log(`  turno ${turno}  ${pad(key, 34)} ${pad(count, 4)} ${bar}`);
  }

  const enTurno3 = activos.filter((p) => ASK_TURN[effectiveProfile(p.pacing_profile)] === 3).length;
  const pct = activos.length ? Math.round((enTurno3 / activos.length) * 100) : 0;
  console.log(`\n  → ${enTurno3}/${activos.length} (${pct}%) preguntan el nombre en la 3era interacción.`);
  console.log(`  → El resto lo hace en turnos 2, 4, 5 o 6 según su arquetipo (por diseño).`);
})();
