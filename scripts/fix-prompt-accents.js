/**
 * Fix missing accents/tildes in all 34 patient system prompts
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FIXES = [
  // Nouns/adjectives
  ["anos", "años"], ["sesion", "sesión"], ["emocion", "emoción"],
  ["reflexion", "reflexión"], ["informacion", "información"],
  ["situacion", "situación"], ["relacion", "relación"],
  ["comunicacion", "comunicación"], ["evaluacion", "evaluación"],
  ["intervencion", "intervención"], ["ideacion", "ideación"],
  ["confrontacion", "confrontación"], ["contencion", "contención"],
  ["motivacion", "motivación"], ["validacion", "validación"],
  ["ocupacion", "ocupación"], ["educacion", "educación"],
  ["clinico", "clínico"], ["clinica", "clínica"],
  ["terapeutico", "terapéutico"], ["terapeutica", "terapéutica"],
  ["psicologica", "psicológica"], ["psicologico", "psicológico"],
  ["psicologa", "psicóloga"], ["psicologo", "psicólogo"],
  ["dificil", "difícil"], ["tambien", "también"],
  ["ademas", "además"], ["despues", "después"],
  ["aqui", "aquí"], ["vacio", "vacío"],
  ["unico", "único"], ["unica", "única"],
  ["ultimo", "último"], ["ultima", "última"],
  ["diagnostico", "diagnóstico"], ["proposito", "propósito"],
  ["medico", "médico"], ["medica", "médica"],
  ["cronico", "crónico"], ["cronica", "crónica"],
  ["musica", "música"], ["basico", "básico"],
  ["rapido", "rápido"], ["valido", "válido"],
  ["biologico", "biológico"], ["fisico", "físico"],
  ["economico", "económico"],
  // Verbs past tense
  ["suicido", "suicidó"], ["murio", "murió"],
  ["crecio", "creció"], ["perdio", "perdió"],
  ["conocio", "conoció"], ["empezo", "empezó"],
  ["confronto", "confrontó"],
  // Imperfect tense
  ["sentia", "sentía"], ["tenia", "tenía"],
  ["sabia", "sabía"], ["queria", "quería"],
  ["podia", "podía"], ["habia", "había"],
  ["vivia", "vivía"], ["creia", "creía"],
  ["decia", "decía"], ["pedia", "pedía"],
  ["seguia", "seguía"],
  // Adverbs
  ["mas ", "más "], ["mas,", "más,"], ["mas.", "más."],
  ["asi ", "así "], ["asi,", "así,"],
  // Family
  ["mama", "mamá"], ["papa ", "papá "],
  // Headers
  ["JAMAS", "JAMÁS"], ["EVALUACION", "EVALUACIÓN"],
  ["COMPORTAMIENTO EN SESION", "COMPORTAMIENTO EN SESIÓN"],
  ["COMUNICACION", "COMUNICACIÓN"],
];

async function main() {
  const { data } = await sb.from("ai_patients").select("id, name, system_prompt").order("name");
  let totalFixes = 0;
  let patientsFixed = 0;

  for (const p of data) {
    let prompt = p.system_prompt || "";
    let fixCount = 0;

    for (const [wrong, right] of FIXES) {
      // Skip if the wrong word doesn't exist or is part of an already correct word
      if (!prompt.includes(wrong)) continue;

      // Replace all occurrences
      const parts = prompt.split(wrong);
      if (parts.length > 1) {
        prompt = parts.join(right);
        fixCount++;
      }
    }

    if (fixCount > 0) {
      const { error } = await sb.from("ai_patients").update({ system_prompt: prompt }).eq("id", p.id);
      console.log(`${p.name}: ${fixCount} correcciones${error ? " ERROR" : ""}`);
      totalFixes += fixCount;
      patientsFixed++;
    }
  }

  console.log(`\nTotal: ${totalFixes} correcciones en ${patientsFixed} pacientes`);
}

main().catch(console.error);
