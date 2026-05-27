/**
 * READ-ONLY — valida la lógica de alcance de src/lib/monitor/scope.ts contra
 * datos reales, replicando sus consultas (no levanta la app). Confirma que
 * cada rol resuelve el conjunto de alumnos esperado y que el fallback de
 * instructor sin sección funciona.
 *
 * Uso: node scripts/diag-monitor-scope.js
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = require("dotenv").parse(fs.readFileSync(".env.production"));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function studentsByEstablishment(estIds) {
  if (!estIds.length) return [];
  const { data } = await s.from("profiles").select("id").eq("role", "student").in("establishment_id", estIds);
  return (data || []).map((p) => p.id);
}
async function studentsBySection(secIds) {
  if (!secIds.length) return [];
  const { data } = await s.from("profiles").select("id").eq("role", "student").in("section_id", secIds);
  return (data || []).map((p) => p.id);
}

(async () => {
  // superadmin → todos
  const { count: totalStudents } = await s
    .from("profiles").select("id", { count: "exact", head: true }).eq("role", "student");
  console.log(`superadmin (mode=all)            → ${totalStudents} alumnos (universo completo)`);

  // admin → admin_establishments
  const adminId = "e25e2556-82bc-44ba-b4a5-1ef2d5c8eba2";
  const { data: ae } = await s.from("admin_establishments").select("establishment_id").eq("admin_id", adminId);
  const adminEstIds = (ae || []).map((a) => a.establishment_id);
  const adminStudents = await studentsByEstablishment(adminEstIds);
  console.log(`admin (${adminEstIds.length} establecimiento/s)        → ${adminStudents.length} alumnos`);

  // instructor con sección → su sección
  const instWithSecId = "7cc9113d-6603-4c4b-8814-200e4d393a1f";
  const { data: iws } = await s.from("profiles").select("section_id, establishment_id").eq("id", instWithSecId).maybeSingle();
  const secStudents = await studentsBySection(iws.section_id ? [iws.section_id] : []);
  console.log(`instructor c/sección (mode=section) → ${secStudents.length} alumnos (sección ${iws.section_id.slice(0, 8)})`);

  // instructor sin sección → fallback establecimiento
  const instNoSecId = "2f2dd378-ab53-4f1a-ac30-058fe88c0e77";
  const { data: ins } = await s.from("profiles").select("section_id, establishment_id").eq("id", instNoSecId).maybeSingle();
  const fallbackStudents = ins.section_id ? [] : await studentsByEstablishment(ins.establishment_id ? [ins.establishment_id] : []);
  console.log(`instructor s/sección (fallback est) → ${fallbackStudents.length} alumnos (est ${(ins.establishment_id||'').slice(0, 8)})`);

  // Sanity: la sección del instructor debe estar contenida en su establecimiento
  console.log("\nChequeo de contención (sección ⊆ establecimiento del instructor c/sección):");
  const instEst = iws.establishment_id ? [iws.establishment_id] : [];
  const instEstStudents = new Set(await studentsByEstablishment(instEst));
  const leaks = secStudents.filter((id) => !instEstStudents.has(id));
  console.log(`  alumnos de la sección fuera del establecimiento del instructor: ${leaks.length} (esperado 0 si los datos son consistentes)`);
})();
