// READ-ONLY. Extrae el cuadro clínico de cada paciente IA activo de PROD
// para el análisis de patologías. Dedup por nombre normalizado (legacy v0 vs v1).
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const cfg = require("dotenv").parse(fs.readFileSync(".env.production"));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const richness = (p) =>
  (p.enrichment_frases_tipo?.text ? 2 : 0) +
  (p.enrichment_estado_corporal?.text ? 1 : 0) +
  ((p.system_prompt || "").length > 800 ? 1 : 0) +
  ((p.presenting_problem || "").length > 0 ? 1 : 0);

(async () => {
  const cols = [
    "id", "name", "age", "occupation", "quote", "presenting_problem", "backstory",
    "personality_traits", "difficulty_level", "tags", "skills_practiced",
    "distinctive_factor", "country_origin", "country_residence", "is_active",
    "enrichment_red_social", "enrichment_lugares",
    "enrichment_frases_tipo", "enrichment_estado_corporal", "system_prompt",
  ].join(", ");

  const { data, error } = await s.from("ai_patients").select(cols).eq("is_active", true);
  if (error) { console.error("SELECT ERR:", error.message); process.exit(1); }

  // Dedup por nombre normalizado, conservando la versión más rica
  const byName = new Map();
  for (const p of data) {
    const k = norm(p.name);
    const cur = byName.get(k);
    if (!cur || richness(p) > richness(cur)) byName.set(k, p);
  }
  const uniq = [...byName.values()].sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

  // Resumen compacto a consola
  console.log(`Activos crudos: ${data.length} | Únicos por nombre: ${uniq.length}\n`);
  for (const p of uniq) {
    const pais = [p.country_origin, p.country_residence].filter(Boolean).join(" → ");
    console.log(`### ${p.name} — ${p.age}a, ${p.occupation} — ${p.difficulty_level} — ${pais}`);
    console.log(`  PROBLEMA: ${p.presenting_problem || "(sin campo)"}`);
    console.log(`  TAGS: ${(p.tags || []).join(", ")}`);
    console.log(`  COMPETENCIAS: ${(p.skills_practiced || []).join(", ")}`);
    if (p.distinctive_factor) console.log(`  FACTOR DISTINTIVO: ${p.distinctive_factor}`);
    console.log("");
  }

  // Volcado completo a JSON (incluye backstory + system_prompt para el análisis fino)
  fs.writeFileSync("scripts/patologias-export.json", JSON.stringify(uniq, null, 2));
  console.log(`\n→ JSON completo en scripts/patologias-export.json (${uniq.length} pacientes)`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
