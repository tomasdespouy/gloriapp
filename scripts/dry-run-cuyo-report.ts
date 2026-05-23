/**
 * Dry-run del pipeline de informe contra el piloto Cuyo (PROD, read-only
 * en DB; hace calls reales al LLM para generar las conclusiones).
 *
 * Uso: npx tsx scripts/dry-run-cuyo-report.ts
 *
 * Carga .env.production en vez de .env.local para apuntar a prod.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Cargar .env.production y mergear sobre process.env ANTES de importar
// cualquier módulo que lea env vars (ai.ts, supabase).
const prodEnv = dotenv.parse(fs.readFileSync(".env.production"));
for (const [k, v] of Object.entries(prodEnv)) process.env[k] = v;
// Reutilizar OPENAI_API_KEY del .env.local si no está en prod (los keys de
// LLM normalmente son compartidos en proyectos GlorIA).
if (!process.env.OPENAI_API_KEY) {
  const localEnv = dotenv.parse(fs.readFileSync(".env.local"));
  for (const [k, v] of Object.entries(localEnv)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

import { createClient } from "@supabase/supabase-js";
import { fetchPilotReportData } from "../src/lib/pilot-report-data";
import { generatePilotDocx } from "../src/lib/generate-pilot-docx";

const CUYO_PILOT_ID = "7c78553d-adec-4ef6-9f7d-7029d66b4a24";

(async () => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log("[1/3] Fetching pilot data...");
  const t0 = Date.now();
  const data = await fetchPilotReportData(admin, CUYO_PILOT_ID);
  console.log(`      Done in ${Date.now() - t0}ms`);

  console.log(`\nPiloto: ${data.pilot.name}`);
  console.log(`Avg seconds per session: ${(data.kpis.avg_seconds_per_session).toFixed(0)}s = ${(data.kpis.avg_seconds_per_session/60).toFixed(1)}m`);
  console.log(`Sesiones evaluadas: ${data.kpis.total_evaluated_sessions}`);
  console.log(`\nEvidencias por competencia:`);
  for (const key of Object.keys(data.competency_evidence) as Array<keyof typeof data.competency_evidence>) {
    const pool = data.competency_evidence[key];
    const f = pool.filter(e => e.polarity === "fortaleza").length;
    const o = pool.filter(e => e.polarity === "oportunidad").length;
    console.log(`  ${key.padEnd(26)} | fortalezas=${String(f).padStart(2)} | oportunidades=${String(o).padStart(2)}`);
  }

  console.log("\n[2/3] Generando docx (con 8 calls al LLM para conclusiones)...");
  const t1 = Date.now();
  const buf = await generatePilotDocx(data);
  console.log(`      Done in ${((Date.now() - t1)/1000).toFixed(1)}s, ${(buf.length/1024).toFixed(1)} KB`);

  const outPath = path.join(process.cwd(), "informes", "pilotos", `DRYRUN-${Date.now()}-cuyo.docx`);
  fs.writeFileSync(outPath, buf);
  console.log(`\n[3/3] Escrito a: ${outPath}`);
})().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
