/**
 * Helper: lee a Diego Fuentes de STAGING (vhkbbps...) y devuelve el
 * paciente con bloques de enriquecimiento aplicados via buildEnrichedPrompt.
 *
 * Salida: { id, name, system_prompt (enriquecido), backstory, presenting_problem }
 */
require("dotenv").config({ path: "C:/Users/tomas/documents/gloriapp/.env.local" });
const { createClient } = require("@supabase/supabase-js");

const STAGING_REF_PREFIX = "vhkbbps";

function assertStaging(url) {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no definido");
  if (!url.includes(STAGING_REF_PREFIX)) {
    throw new Error(
      `URL Supabase no es staging: ${url}. Se esperaba contener "${STAGING_REF_PREFIX}".`,
    );
  }
}

// Versión JS de buildEnrichedPrompt (puerto fiel del .ts)
const COMPORTAMIENTO_MARKERS = [
  "\n\nCOMPORTAMIENTO EN SESIÓN:",
  "\n\nCOMPORTAMIENTO EN SESION:",
  "\nCOMPORTAMIENTO EN SESIÓN:",
  "\nCOMPORTAMIENTO EN SESION:",
];
const REGLAS_MARKERS = ["\n\nREGLAS:", "\nREGLAS:"];

function findFirstMarker(text, markers) {
  for (const m of markers) if (text.includes(m)) return m;
  return null;
}

function buildEnrichedPrompt(p) {
  let prompt = (p.system_prompt || "").replace(/\r\n/g, "\n");
  const rs = p.enrichment_red_social?.text?.trim();
  const lu = p.enrichment_lugares?.text?.trim();
  const ec = p.enrichment_estado_corporal?.text?.trim();
  const ft = p.enrichment_frases_tipo?.text?.trim();

  const earlyBlocks = [rs, lu, ec].filter(Boolean).join("\n\n");
  if (earlyBlocks) {
    const m = findFirstMarker(prompt, COMPORTAMIENTO_MARKERS);
    if (m) prompt = prompt.replace(m, `\n\n${earlyBlocks}${m}`);
    else {
      const r = findFirstMarker(prompt, REGLAS_MARKERS);
      if (r) prompt = prompt.replace(r, `\n\n${earlyBlocks}${r}`);
      else prompt = `${prompt}\n\n${earlyBlocks}`;
    }
  }

  if (ft) {
    const r = findFirstMarker(prompt, REGLAS_MARKERS);
    if (r) prompt = prompt.replace(r, `\n\n${ft}${r}`);
    else prompt = `${prompt}\n\n${ft}`;
  }
  return prompt;
}

async function loadDiego() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assertStaging(url);

  const sb = createClient(url, key);
  const { data: rows, error } = await sb
    .from("ai_patients")
    .select(
      "id, name, age, system_prompt, backstory, presenting_problem, is_active, " +
        "enrichment_red_social, enrichment_lugares, enrichment_estado_corporal, enrichment_frases_tipo",
    )
    .ilike("name", "%Diego%");

  if (error) throw error;
  if (!rows || rows.length === 0) {
    throw new Error("Ningún paciente Diego encontrado en staging");
  }
  // Preferir activo y con enriquecimiento red_social (Diego Fuentes INF-050)
  const data =
    rows.find((r) => r.is_active && r.enrichment_red_social) ||
    rows.find((r) => r.is_active) ||
    rows[0];

  const system_prompt = buildEnrichedPrompt(data);
  return { ...data, system_prompt };
}

module.exports = { loadDiego, assertStaging };

if (require.main === module) {
  loadDiego()
    .then((p) => {
      console.log(`[ok] Diego cargado: ${p.id}`);
      console.log(`     System prompt length: ${p.system_prompt.length} chars`);
      console.log(`     Enrichment red_social: ${p.enrichment_red_social ? "yes" : "no"}`);
      console.log(`     Enrichment lugares:    ${p.enrichment_lugares ? "yes" : "no"}`);
      console.log(`     Enrichment estado:     ${p.enrichment_estado_corporal ? "yes" : "no"}`);
      console.log(`     Enrichment frases:     ${p.enrichment_frases_tipo ? "yes" : "no"}`);
    })
    .catch((e) => {
      console.error("[err]", e.message);
      process.exit(1);
    });
}
