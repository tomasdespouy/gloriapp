/**
 * Chequea referencias FK de los 5 duplicados a borrar en STAGING.
 * READ-ONLY. No modifica nada.
 *
 * Para cada ID candidato a borrar, cuenta:
 *  - conversations
 *  - establishment_patients
 *
 * Uso: node scripts/check-staging-duplicates-fks.js
 */
const fs = require("fs");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const env = dotenv.parse(fs.readFileSync(".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
console.log(`[INFO] STAGING ref: ${ref}\n`);

// IDs candidatos a borrar (los v0 May 11 que duplican v1 Apr 15)
const candidates = [
  { name: "Carmen Torres", keep: "9ece8f92-4ec7-47e0-b5f9-806082425e79", drop: "c6ffbf63-988e-468a-9c71-c44c54f98fda" },
  { name: "Diego Fuentes", keep: "38390ef5-4543-4beb-8376-1b3a10853148", drop: "99bdb71e-efae-4f53-9527-bac3e2d743a0" },
  { name: "Lucía Mendoza", keep: "8b7961ad-cf19-4ef6-9943-c525be046ee3", drop: "6f2afbe5-229f-4beb-8bb3-365217c83c2b" },
  { name: "Marcos Herrera", keep: "ff97ac31-56aa-464b-99b0-4e5c675e0986", drop: "7d14f579-bd50-431b-a4bf-c93b3992d79c" },
  { name: "Roberto Salas", keep: "1b696be8-f160-4035-9840-e77a800f9efb", drop: "cde66d68-f3f6-4d53-8760-a5751d0da7c3" },
];

const client = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  console.log("=== Referencias FK a los IDs candidatos a BORRAR ===\n");
  const summary = [];
  for (const c of candidates) {
    const [{ count: convs }, { count: ep }] = await Promise.all([
      client.from("conversations").select("id", { count: "exact", head: true }).eq("ai_patient_id", c.drop),
      client.from("establishment_patients").select("ai_patient_id", { count: "exact", head: true }).eq("ai_patient_id", c.drop),
    ]);
    summary.push({ ...c, convs: convs ?? 0, ep: ep ?? 0 });
    console.log(`${c.name.padEnd(20)} drop=${c.drop.slice(0, 8)} | conversations=${convs ?? 0} | establishment_patients=${ep ?? 0}`);
  }

  console.log("\n=== Referencias FK a los IDs que MANTENEMOS (sanity check) ===\n");
  for (const c of candidates) {
    const [{ count: convs }, { count: ep }] = await Promise.all([
      client.from("conversations").select("id", { count: "exact", head: true }).eq("ai_patient_id", c.keep),
      client.from("establishment_patients").select("ai_patient_id", { count: "exact", head: true }).eq("ai_patient_id", c.keep),
    ]);
    console.log(`${c.name.padEnd(20)} keep=${c.keep.slice(0, 8)} | conversations=${convs ?? 0} | establishment_patients=${ep ?? 0}`);
  }

  const blockers = summary.filter((s) => s.convs > 0 || s.ep > 0);
  console.log("\n=== Veredicto ===");
  if (blockers.length === 0) {
    console.log("OK — los 5 duplicados no tienen ninguna referencia FK. Borrado seguro.");
  } else {
    console.log("ATENCIÓN — algunos duplicados tienen referencias y borrarlos romperá data:");
    blockers.forEach((b) => {
      console.log(`  ${b.name} (drop=${b.drop.slice(0, 8)}): convs=${b.convs}, ep=${b.ep}`);
    });
    console.log("\nOpciones: (a) migrar referencias al ID que mantenemos antes de borrar; (b) marcar como is_active=false en vez de borrar.");
  }
})();
