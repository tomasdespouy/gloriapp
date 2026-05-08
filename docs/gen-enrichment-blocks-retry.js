/**
 * Retry para los pacientes que fallaron por rate limit en la corrida inicial.
 * Concurrencia 1, backoff exponencial.
 */
const fs = require("fs");
const { OpenAI } = require("openai");

const env = fs.readFileSync(".env.local", "utf8");
const apiKey = env.match(/OPENAI_API_KEY=(\S+)/)[1];
const openai = new OpenAI({ apiKey });

const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/all-patients.json", "utf8"));
const EXISTING = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));

// Cargar el meta-prompt y buildContext desde el script principal sin duplicar
// (copia mínima)
const META_PROMPT = `Eres experto en construcción de pacientes simulados para entrenamiento clínico de psicología. Recibes los datos de un paciente IA existente y debes generar 4 bloques de contenido nuevo para enriquecer su prompt sistémico.

OBJETIVO: agregar densidad biográfica concreta sin tocar la estructura clínica del prompt.

REGLAS DURAS:
1. Coherencia absoluta con la familia (family_members) ya definida.
2. Dialecto del país de origen del paciente.
3. Coherencia con la edad, ocupación, motivo de consulta y barrio.
4. NUNCA inventes contenido que contradiga el prompt original.
5. NUNCA agregues elementos clínicos nuevos que cambien el cuadro.
6. NO uses emojis.
7. Mantén el formato de líneas con guion (-) y datos concretos.

LOS 4 BLOQUES:
- BLOQUE 1 RED SOCIAL Y VÍNCULOS (5-8 líneas): familia ya conocida con detalles + 1-3 personas del círculo cotidiano.
- BLOQUE 2 LUGARES SIGNIFICATIVOS (3-5 líneas): lugares físicos concretos del día a día con detalle sensorial.
- BLOQUE 3 ESTADO CORPORAL Y RUTINA (4-6 líneas): sueño, apetito, cuerpo, vestimenta, rutina, COHERENTE con motivo de consulta.
- BLOQUE 4 FRASES TIPO QUE DICES (6-8 líneas): frases entre comillas, dialecto del país, patrón comunicativo.

FORMATO DE SALIDA: JSON estricto:
{
  "red_social_y_vinculos": "RED SOCIAL Y VÍNCULOS:\\n- línea 1\\n...",
  "lugares_significativos": "LUGARES SIGNIFICATIVOS:\\n- línea 1\\n...",
  "estado_corporal_y_rutina": "ESTADO CORPORAL Y RUTINA:\\n- línea 1\\n...",
  "frases_tipo_que_dices": "FRASES TIPO QUE DICES:\\n- \\"frase 1\\"\\n..."
}`;

function buildContext(p) {
  const country = Array.isArray(p.country) ? p.country.join("/") : p.country;
  const family = (p.family_members || []).map(f =>
    `${f.name} (${f.age}, ${f.relationship})${f.notes ? ` — ${f.notes}` : ""}`
  ).join("; ");
  const visual = p.visual_identity || {};
  return `DATOS DEL PACIENTE
- Nombre: ${p.name}
- Edad: ${p.age}
- Ocupación: ${p.occupation}
- País: ${country}
- Barrio: ${p.neighborhood || "(no especificado)"}
- Cita: "${p.quote}"
- Motivo de consulta: ${p.presenting_problem}
- Dificultad: ${p.difficulty_level}
- Tags: ${(p.tags || []).join(", ")}
- Backstory: ${p.backstory}
- Familia: ${family || "(no especificada)"}
- Identidad visual: ${visual.etnia || "?"}, ${visual.gesto || "?"}, ${visual.ropa_tipo || "?"} ${visual.ropa_color || ""}

PROMPT ACTUAL:
${p.system_prompt}`;
}

async function generateWithRetry(patient, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          { role: "system", content: META_PROMPT },
          { role: "user", content: buildContext(patient) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });
      return {
        blocks: JSON.parse(completion.choices[0].message.content),
        tokens: completion.usage,
      };
    } catch (e) {
      if (e.status === 429 && attempt < maxRetries - 1) {
        const wait = Math.min(60000, (1500 * Math.pow(2, attempt)) + Math.random() * 1000);
        console.log(`  ${patient.name}: 429, esperando ${(wait/1000).toFixed(1)}s (intento ${attempt+1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}

(async () => {
  // Identificar los que fallaron
  const failed = EXISTING.patients.filter(p => p.error || !p.enriched_blocks);
  console.log(`Reintentando ${failed.length} pacientes que fallaron por rate limit`);

  for (const f of failed) {
    const orig = PATIENTS.find(p => p.id === f.id);
    console.log(`\n→ ${orig.name}`);
    try {
      const r = await generateWithRetry(orig);
      // actualizar en EXISTING
      const idx = EXISTING.patients.findIndex(p => p.id === f.id);
      EXISTING.patients[idx].enriched_blocks = r.blocks;
      EXISTING.patients[idx].error = null;
      EXISTING.patients[idx].tokens = r.tokens;
      console.log(`  ✓ OK (${r.tokens.total_tokens} tokens)`);
      // Esperar para no exceder TPM
      await new Promise(r => setTimeout(r, 2500));
    } catch (e) {
      console.log(`  ✗ Falló definitivamente: ${e.message}`);
    }
  }

  EXISTING.successes = EXISTING.patients.filter(p => p.enriched_blocks && !p.error).length;
  EXISTING.failures = EXISTING.patients.filter(p => p.error || !p.enriched_blocks).length;
  EXISTING.retried_at = new Date().toISOString();

  fs.writeFileSync("C:/tmp/enriched-blocks.json", JSON.stringify(EXISTING, null, 2));
  console.log(`\n✓ Guardado · OK: ${EXISTING.successes}/${EXISTING.patients.length}`);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
