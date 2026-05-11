/**
 * Sembrar en STAGING los 11 pacientes que están en PROD pero faltan en staging.
 * Lee los datos completos de cada paciente desde PROD vía API REST y los inserta
 * en STAGING preservando el UUID original (para mantener correspondencia entre bases).
 *
 * Idempotente: si un paciente ya existe (por id), se hace un PATCH en lugar de INSERT.
 */
const fs = require("fs");

function loadEnv(file) {
  const env = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1];
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/)[1];
  return { url, key };
}

const PROD = loadEnv(".env.production");
const STAGING = loadEnv(".env.local");

if (!STAGING.url.includes("vhkbbps")) {
  console.error("❌ ERROR: .env.local NO apunta a STAGING. Aborto.");
  process.exit(1);
}
console.log(`PROD:    ${PROD.url.match(/https:\/\/(\w+)/)[1]}`);
console.log(`STAGING: ${STAGING.url.match(/https:\/\/(\w+)/)[1]}\n`);

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const MISSING_NAMES = [
  "Andrés Castillo", "Carlos Paredes", "Gabriel Navarro", "Jorge Ramírez",
  "Mariana Sánchez", "Mateo Giménez", "Rafael Santos", "Rosa Huamán",
  "Sofía Pellegrini", "Valentina Ospina", "Yamilet Pérez",
];

// Columnas que copiamos. Excluimos created_at, updated_at, prompt_snapshot
// (no aplica) y los enrichment_* (los aplica el script siguiente).
const COPY_COLS = [
  "id", "name", "age", "occupation", "quote", "presenting_problem", "backstory",
  "system_prompt", "personality_traits", "difficulty_level", "tags",
  "skills_practiced", "total_sessions", "country", "country_origin",
  "country_residence", "neighborhood", "birthday", "family_members",
  "visual_identity", "voice_id", "pacing_profile", "distinctive_factor",
  "is_active",
];

(async () => {
  // 1) Cargar TODOS los pacientes desde PROD con todas las columnas
  console.log("1. Leyendo los 11 pacientes desde PROD");
  const r1 = await fetch(
    `${PROD.url}/rest/v1/ai_patients?select=${COPY_COLS.join(",")}`,
    { headers: { apikey: PROD.key, Authorization: "Bearer " + PROD.key } }
  );
  const allProd = await r1.json();
  const missing = allProd.filter(p => MISSING_NAMES.some(n => norm(n) === norm(p.name)));
  console.log(`   Encontrados en PROD: ${missing.length}/${MISSING_NAMES.length}`);

  // 2) Para cada uno: chequear si ya existe en STAGING (por id), si no INSERT, si sí PATCH
  console.log("\n2. Sembrando en STAGING");
  let inserted = 0, updated = 0, errors = [];
  for (const p of missing) {
    // Check existencia en staging
    const checkRes = await fetch(
      `${STAGING.url}/rest/v1/ai_patients?id=eq.${p.id}&select=id`,
      { headers: { apikey: STAGING.key, Authorization: "Bearer " + STAGING.key } }
    );
    const check = await checkRes.json();
    const exists = Array.isArray(check) && check.length > 0;

    const headers = {
      apikey: STAGING.key,
      Authorization: "Bearer " + STAGING.key,
      "Content-Type": "application/json",
    };

    if (exists) {
      const r = await fetch(`${STAGING.url}/rest/v1/ai_patients?id=eq.${p.id}`, {
        method: "PATCH", headers, body: JSON.stringify(p),
      });
      if (r.ok) { updated++; console.log(`   ↻ updated  ${p.name}`); }
      else errors.push({ name: p.name, step: "PATCH", err: await r.text() });
    } else {
      const r = await fetch(`${STAGING.url}/rest/v1/ai_patients`, {
        method: "POST", headers, body: JSON.stringify(p),
      });
      if (r.ok) { inserted++; console.log(`   + inserted ${p.name}`); }
      else errors.push({ name: p.name, step: "POST", err: await r.text() });
    }
  }

  console.log("\n=== RESUMEN ===");
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated:  ${updated}`);
  console.log(`   Errors:   ${errors.length}`);
  if (errors.length) {
    for (const e of errors.slice(0, 5)) {
      console.log(`   [${e.step}] ${e.name}: ${e.err.slice(0, 200)}`);
    }
  }
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
