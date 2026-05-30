/**
 * Borra los 5 ai_patients duplicados en STAGING.
 *
 * Plan:
 *  1. Migrar la 1 conversation que apunta a Lucía v0 → Lucía v1 (FK fix)
 *  2. Borrar los 5 IDs duplicados
 *
 * Pasa --execute para ejecutar de verdad. Sin --execute solo imprime el plan.
 *
 * NO TOCA PROD. Solo .env.local (staging).
 *
 * Uso:
 *   node scripts/delete-staging-duplicates.js          # dry-run
 *   node scripts/delete-staging-duplicates.js --execute
 */
const fs = require("fs");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const env = dotenv.parse(fs.readFileSync(".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];

const STAGING_REF = "vhkbbpsdiklguxvjrksd";
if (ref !== STAGING_REF) {
  console.error(`[ABORT] Esperaba ref staging (${STAGING_REF}) pero .env.local apunta a ${ref}.`);
  console.error("Revisa NEXT_PUBLIC_SUPABASE_URL en .env.local. No se ejecutará nada.");
  process.exit(1);
}

const execute = process.argv.includes("--execute");
console.log(`[INFO] STAGING ref: ${ref}`);
console.log(`[INFO] Modo: ${execute ? "EJECUTAR" : "DRY-RUN (sin --execute)"}\n`);

const LUCIA_V0_DROP = "6f2afbe5-229f-4beb-8bb3-365217c83c2b";
const LUCIA_V1_KEEP = "8b7961ad-cf19-4ef6-9943-c525be046ee3";

const DUPLICATES_TO_DELETE = [
  { name: "Carmen Torres",  id: "c6ffbf63-988e-468a-9c71-c44c54f98fda" },
  { name: "Diego Fuentes",  id: "99bdb71e-efae-4f53-9527-bac3e2d743a0" },
  { name: "Lucía Mendoza",  id: LUCIA_V0_DROP },
  { name: "Marcos Herrera", id: "7d14f579-bd50-431b-a4bf-c93b3992d79c" },
  { name: "Roberto Salas",  id: "cde66d68-f3f6-4d53-8760-a5751d0da7c3" },
];

const client = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { count: beforeCount } = await client
    .from("ai_patients")
    .select("id", { count: "exact", head: true });
  console.log(`[BEFORE] Total ai_patients en staging: ${beforeCount}\n`);

  // ── Paso 1: migrar la conversation de Lucía v0 → Lucía v1 ──
  console.log("=== Paso 1: migrar FK conversation ===");
  const { data: convToMigrate, error: selErr } = await client
    .from("conversations")
    .select("id, student_id, created_at, status")
    .eq("ai_patient_id", LUCIA_V0_DROP);

  if (selErr) { console.error("[ERROR]", selErr); process.exit(1); }

  console.log(`Encontradas ${convToMigrate.length} conversation(s) apuntando a Lucía v0:`);
  convToMigrate.forEach((c) => console.log(`  id=${c.id} student=${c.student_id} status=${c.status} created=${c.created_at}`));

  if (execute && convToMigrate.length > 0) {
    const { error: updErr } = await client
      .from("conversations")
      .update({ ai_patient_id: LUCIA_V1_KEEP })
      .eq("ai_patient_id", LUCIA_V0_DROP);
    if (updErr) { console.error("[ERROR migrate]", updErr); process.exit(1); }
    console.log(`[OK] Migrado(s) ${convToMigrate.length} conversation(s) a Lucía v1.`);
  } else if (!execute) {
    console.log("[DRY-RUN] No se ejecuta el UPDATE.");
  }

  // ── Paso 2: borrar los 5 duplicados ──
  console.log("\n=== Paso 2: borrar 5 ai_patients duplicados ===");
  for (const dup of DUPLICATES_TO_DELETE) {
    if (!execute) {
      console.log(`[DRY-RUN] DELETE FROM ai_patients WHERE id = '${dup.id}'   -- ${dup.name}`);
      continue;
    }
    const { error: delErr } = await client.from("ai_patients").delete().eq("id", dup.id);
    if (delErr) {
      console.error(`[ERROR delete ${dup.name}]`, delErr);
      process.exit(1);
    }
    console.log(`[OK] Borrado ${dup.name} (id=${dup.id.slice(0, 8)}...)`);
  }

  // ── Verificación final ──
  const { count: afterCount } = await client
    .from("ai_patients")
    .select("id", { count: "exact", head: true });
  console.log(`\n[AFTER] Total ai_patients en staging: ${afterCount}`);
  if (execute) {
    if (afterCount === 34) {
      console.log("✓ OK — staging ahora tiene 34 pacientes, igual que prod por conteo.");
    } else {
      console.log(`⚠ Esperaba 34, quedó en ${afterCount}.`);
    }
  } else {
    console.log("(sin cambios — dry-run)");
  }
})();
