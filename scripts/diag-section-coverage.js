/**
 * READ-ONLY — Fase 0 del monitor operacional.
 *
 * Mide si el alcance "por sección" es viable hoy. El modelo de datos lo
 * soporta (profiles.section_id / course_id existen), pero hasta ahora el
 * panel docente scopeaba por establecimiento, así que esos campos pueden
 * estar vacíos. Si lo están, el alcance por sección caería siempre a
 * establecimiento (fallback acordado).
 *
 * Reporta, por establecimiento:
 *   - instructores con/sin section_id y course_id
 *   - alumnos con/sin section_id y course_id
 *   - secciones existentes y cuántos alumnos cuelgan de cada una
 *
 * Uso:  node scripts/diag-section-coverage.js
 * (lee credenciales de .env.production — no escribe nada)
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

const env = dotenv.parse(fs.readFileSync(".env.production"));
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function pct(part, total) {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

(async () => {
  // 1) Establecimientos
  const { data: establishments, error: estErr } = await supa
    .from("establishments")
    .select("id, name")
    .order("name");
  if (estErr) { console.error("Error leyendo establishments:", estErr.message); process.exit(1); }

  const estName = new Map((establishments || []).map((e) => [e.id, e.name]));

  // 2) Perfiles relevantes (instructor + student)
  const { data: profiles, error: profErr } = await supa
    .from("profiles")
    .select("id, role, establishment_id, course_id, section_id")
    .in("role", ["instructor", "student"]);
  if (profErr) { console.error("Error leyendo profiles:", profErr.message); process.exit(1); }

  // 3) Secciones (para listar y contar)
  const { data: sections } = await supa
    .from("sections")
    .select("id, name, course_id");
  const { data: courses } = await supa
    .from("courses")
    .select("id, establishment_id, name");

  const courseEst = new Map((courses || []).map((c) => [c.id, c.establishment_id]));

  // Agrupar perfiles por establecimiento + rol
  const byEst = new Map(); // estId -> { instructors:[], students:[] }
  const ensure = (estId) => {
    const key = estId || "SIN_ESTABLECIMIENTO";
    if (!byEst.has(key)) byEst.set(key, { instructors: [], students: [] });
    return byEst.get(key);
  };
  for (const p of profiles || []) {
    const bucket = ensure(p.establishment_id);
    if (p.role === "instructor") bucket.instructors.push(p);
    else bucket.students.push(p);
  }

  // Conteo de alumnos por sección
  const studentsBySection = new Map();
  for (const p of profiles || []) {
    if (p.role === "student" && p.section_id) {
      studentsBySection.set(p.section_id, (studentsBySection.get(p.section_id) || 0) + 1);
    }
  }
  const sectionName = new Map((sections || []).map((s) => [s.id, s.name]));

  console.log("=".repeat(78));
  console.log("COBERTURA DE SECCIONES — viabilidad del alcance por sección");
  console.log("=".repeat(78));

  let totalInstWithSection = 0;
  let totalInst = 0;
  let totalStudWithSection = 0;
  let totalStud = 0;

  // Ordenar: establecimientos con nombre primero
  const keys = [...byEst.keys()].sort((a, b) => {
    const na = estName.get(a) || a;
    const nb = estName.get(b) || b;
    return String(na).localeCompare(String(nb));
  });

  for (const key of keys) {
    const { instructors, students } = byEst.get(key);
    const name = key === "SIN_ESTABLECIMIENTO" ? "(sin establecimiento)" : (estName.get(key) || key.slice(0, 8));

    const instSec = instructors.filter((i) => i.section_id).length;
    const instCourse = instructors.filter((i) => i.course_id).length;
    const studSec = students.filter((s) => s.section_id).length;
    const studCourse = students.filter((s) => s.course_id).length;

    totalInst += instructors.length;
    totalInstWithSection += instSec;
    totalStud += students.length;
    totalStudWithSection += studSec;

    console.log(`\n■ ${name}`);
    console.log(`   Instructores: ${instructors.length}`);
    console.log(`      con section_id: ${instSec} (${pct(instSec, instructors.length)})  |  con course_id: ${instCourse} (${pct(instCourse, instructors.length)})`);
    console.log(`   Alumnos: ${students.length}`);
    console.log(`      con section_id: ${studSec} (${pct(studSec, students.length)})  |  con course_id: ${studCourse} (${pct(studCourse, students.length)})`);
  }

  // Secciones definidas y su población
  console.log("\n" + "=".repeat(78));
  console.log("SECCIONES DEFINIDAS Y POBLACIÓN DE ALUMNOS");
  console.log("=".repeat(78));
  if (!sections || sections.length === 0) {
    console.log("  (no hay secciones creadas)");
  } else {
    for (const s of sections) {
      const estId = courseEst.get(s.course_id);
      const en = estId ? (estName.get(estId) || estId.slice(0, 8)) : "?";
      const n = studentsBySection.get(s.id) || 0;
      console.log(`  ${(s.name || "(sin nombre)").padEnd(28)} | est: ${String(en).padEnd(24)} | alumnos: ${n}`);
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log("RESUMEN GLOBAL");
  console.log("=".repeat(78));
  console.log(`  Instructores con sección: ${totalInstWithSection}/${totalInst} (${pct(totalInstWithSection, totalInst)})`);
  console.log(`  Alumnos con sección:      ${totalStudWithSection}/${totalStud} (${pct(totalStudWithSection, totalStud)})`);
  console.log("");
  if (totalInstWithSection === 0) {
    console.log("  ⇒ Ningún instructor tiene sección asignada: el alcance por sección");
    console.log("    caería SIEMPRE al fallback de establecimiento. Funciona, pero no");
    console.log("    acota nada hasta que se asignen secciones.");
  } else if (totalInstWithSection < totalInst) {
    console.log("  ⇒ Cobertura parcial: algunos instructores verán su sección, otros");
    console.log("    el establecimiento completo (fallback). Comportamiento mixto.");
  } else {
    console.log("  ⇒ Cobertura completa de instructores: el alcance por sección es viable.");
  }
})();
