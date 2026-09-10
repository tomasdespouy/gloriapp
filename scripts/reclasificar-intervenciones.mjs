/**
 * Pasa los mensajes REALES ya registrados por el clasificador actual y compara
 * con la clasificación que quedó guardada.
 *
 * Es la única forma honesta de saber si un cambio al clasificador mejora algo:
 * inventar casos de prueba mide lo que uno imaginó, no lo que los estudiantes
 * escriben. clinical_state_log guarda intervention_raw, así que se puede
 * reproducir sobre miles de turnos verdaderos.
 *
 * NO escribe nada: la reclasificación no se aplica hacia atrás. Cambiar el
 * clasificador cambia las trayectorias futuras, no las que ya ocurrieron.
 *
 * Uso: node scripts/reclasificar-intervenciones.mjs [--est <uuid>] [--ver <tipo>]
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const EST = flag("--est");
const VER = flag("--ver");

const cfg = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// El clasificador REAL. clinical-state-engine no importa nada, así que carga suelto.
const { classifyIntervention } = await import(
  "file://" + path.join(ROOT, "src/lib/clinical-state-engine.ts").replace(/\\/g, "/")
);

let convIds = null;
if (EST) {
  const { data: al } = await s.from("profiles").select("id,email").eq("establishment_id", EST).eq("role", "student");
  const alum = (al || []).filter((a) => !/smoketest|tomasdespouy|@glor-ia\.com$/i.test(a.email || ""));
  const { data: cs } = await s.from("conversations").select("id").in("student_id", alum.map((a) => a.id));
  convIds = (cs || []).map((c) => c.id);
}

let log = [];
if (convIds) {
  for (let i = 0; i < convIds.length; i += 50) {
    const ch = convIds.slice(i, i + 50); let d0 = 0;
    for (;;) {
      const { data } = await s.from("clinical_state_log")
        .select("intervention_type,intervention_raw").in("conversation_id", ch).range(d0, d0 + 999);
      log = log.concat(data || []); if (!data || data.length < 1000) break; d0 += 1000;
    }
  }
} else {
  for (let off = 0; ; off += 1000) {
    const { data } = await s.from("clinical_state_log")
      .select("intervention_type,intervention_raw").range(off, off + 999);
    if (!data || !data.length) break; log = log.concat(data); if (data.length < 1000) break;
  }
}

const conTexto = log.filter((x) => x.intervention_raw);
console.log(`turnos con texto guardado: ${conTexto.length}\n`);

const antes = {}, despues = {}, cambios = {};
for (const x of conTexto) {
  const a = x.intervention_type || "?";
  const b = classifyIntervention(x.intervention_raw);
  antes[a] = (antes[a] || 0) + 1;
  despues[b] = (despues[b] || 0) + 1;
  if (a !== b) cambios[`${a} → ${b}`] = (cambios[`${a} → ${b}`] || 0) + 1;
}

const tipos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].sort();
const pc = (n) => `${((100 * n) / conTexto.length).toFixed(1)}%`;
console.log("TIPO                        ANTES            AHORA");
for (const t of tipos) {
  const a = antes[t] || 0, b = despues[t] || 0;
  const flecha = b > a ? "↑" : b < a ? "↓" : " ";
  console.log(`${t.padEnd(26)} ${String(a).padStart(5)} ${pc(a).padStart(7)}   ${String(b).padStart(5)} ${pc(b).padStart(7)}  ${flecha}`);
}

console.log("\nMOVIMIENTOS PRINCIPALES");
for (const [k, v] of Object.entries(cambios).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`   ${String(v).padStart(4)}  ${k}`);
}

if (VER) {
  console.log(`\nMUESTRA DE LO QUE AHORA CAE EN "${VER}"`);
  const muestra = conTexto.filter((x) => classifyIntervention(x.intervention_raw) === VER && x.intervention_type !== VER);
  for (const x of muestra.slice(0, 12)) {
    console.log(`   [era ${x.intervention_type}] "${String(x.intervention_raw).replace(/\s+/g, " ").slice(0, 92)}"`);
  }
}
