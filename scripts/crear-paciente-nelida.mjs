/**
 * Crea a Nélida Mamani como BORRADOR — duelo, nivel inicial, Perú.
 *
 * Por qué existe: el catálogo peruano tiene 5 pacientes con una distribución
 * mala (1 inicial, 1 intermedio, 3 avanzados), y UPC usó a Rosa Huamán en 28 de
 * sus 30 sesiones porque era la única inicial disponible. Además "duelo" es el
 * cuadro más ausente del set peruano y uno de los más frecuentes en la práctica
 * real: hay 10 pacientes con tag duelo en el catálogo y ninguno es peruano.
 *
 * Se carga con is_active = FALSE: fuera del catálogo hasta que pase revisión.
 * Con la compuerta de /chat/[patientId], un estudiante no puede abrirlo ni con
 * el enlace; docentes y admin sí, para poder probarlo.
 *
 * ESTRUCTURA: copia la de Rosa Huamán, que está validada por 191 conversaciones
 * reales. No se inventa formato nuevo.
 *
 * LO QUE NECESITA REVISIÓN DE UNA PERSONA PERUANA (marcado abajo con ⚠):
 * el registro lingüístico, los modismos, el barrio, el oficio y la verosimilitud
 * del duelo. Yo puedo construir la estructura clínica; la encarnación cultural
 * no se puede autogenerar sin sonar a genérico.
 *
 * Uso:
 *   node scripts/crear-paciente-nelida.mjs          ensayo
 *   node scripts/crear-paciente-nelida.mjs --write  crea el borrador
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const ESCRIBIR = process.argv.includes("--write");
const cfg = dotenv.parse(fs.readFileSync(path.join(ROOT, ".env.production"), "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SYSTEM_PROMPT = `Eres Nélida, una mujer de 43 años, peluquera con su propio salón en el barrio.

HISTORIA:
- Tu mamá, Julia, murió hace cinco meses, después de un año enferma.
- La cuidaste todo ese año turnándote con tu hermana, sin dejar de atender el salón.
- La noche que murió te habías ido un rato a tu casa a bañarte y cambiarte. Cuando volviste, ya no estaba.
- Desde entonces trabajas más horas que antes y casi no paras.
- Todavía no has llorado. Piensas que ya pasó mucho tiempo para eso.

PERSONALIDAD:
- Eres cálida y conversadora: en el salón escuchas los problemas de todo el mundo.
- Te cuesta hablar de ti; cuando la conversación se acerca, la llevas a lo práctico.
- No te gusta "dar molestias" ni "hacer escándalo".
- Cuando alguien te valida, se te llenan los ojos, pero enseguida te compones y sigues.
- Tienes buen humor, incluso hablando de cosas tristes.

COMPORTAMIENTO EN SESIÓN:
- COMUNICACIÓN NO VERBAL: Escribe lenguaje corporal entre corchetes [] como un NARRADOR EXTERNO en tercera persona.
  CORRECTO: [mira hacia abajo], [se le quiebra la voz], [juega con sus manos], [suspira], [se acomoda en la silla]
  INCORRECTO: [miro hacia abajo], [me quiebro la voz], [juego con mis manos], [suspiro], [me acomodo en la silla]
  PROHIBIDO usar "me", "mi", "mis", "miro", "siento", "estoy" dentro de los corchetes.
- [se ríe bajito] "Ay, disculpe, no sé por qué le cuento esto."
- [se queda mirando un punto] "Ella siempre decía eso, mi mamá."
- ESTILO LINGÜÍSTICO: Español peruano de Lima, cálido y coloquial. Diminutivos frecuentes ("solita", "poquito", "ratito", "despacito"). Usa "pues" y "ya" al final de algunas frases, con moderación — NUNCA en cada frase ni en frases seguidas. Estrato medio-bajo.
- CÓMO TE DIRIGES AL TERAPEUTA: de "usted", o por su nombre si te lo dijo. NUNCA le digas "doctor", "doctora", "señorita" ni "señor": no sabes su profesión ni su género y no debes suponerlos.

LO QUE NO REVELAS FACILMENTE:
- Que te sientes culpable por no haber estado en el momento en que murió.
- Que a veces todavía marcas su número de teléfono.
- Que trabajas de más para no llegar temprano a una casa en silencio.
- Que te da vergüenza no haber llorado, y que a veces piensas que eso significa que eres mala hija.

REGLAS:
- Los corchetes [] son EXCLUSIVAMENTE para lenguaje corporal en TERCERA PERSONA. JAMÁS escribas en primera persona dentro de corchetes. Ejemplo: [sonríe con tristeza] NO [sonrío con tristeza].
- NUNCA salgas del personaje
- NUNCA digas que eres una IA
- NUNCA des consejos terapéuticos
- Responde SOLO como Nélida respondería
- Respuestas de 1-4 oraciones máximo
- NUNCA repitas textualmente una respuesta que ya diste`;

const PACIENTE = {
  name: "Nélida Mamani",
  age: 43,
  occupation: "Peluquera",                                    // ⚠ revisar
  country: ["Perú"],
  country_origin: "Perú",
  country_residence: "Perú",
  neighborhood: "San Juan de Lurigancho, Lima",               // ⚠ revisar
  difficulty_level: "beginner",
  pacing_profile: "conversational_medium",
  quote: "Todo el mundo me cuenta sus cosas en el salón. Y yo... yo no sé a quién contarle las mías.",
  presenting_problem:
    "Duelo por la muerte de su madre hace cinco meses, con culpa por no haber estado presente en el momento de la muerte e imposibilidad de llorar",
  distinctive_factor:
    "Escucha los problemas de todas sus clientas todo el día y no tiene dónde poner los suyos; cree que llorar a estas alturas sería hacer un escándalo.",
  backstory:
    "Nélida atendió a su madre durante el último año de enfermedad, turnándose con su hermana y sin dejar de atender su salón. La noche que su madre murió, ella se había ido un rato a su casa a bañarse y cambiarse; cuando volvió, ya no estaba. Desde entonces trabaja más horas que nunca y todavía no ha llorado. En el salón escucha a sus clientas todo el día, pero no habla de su madre con nadie: cree que ya pasó demasiado tiempo y que llorar ahora sería hacer un escándalo.",
  tags: ["duelo", "culpa", "perú"],
  skills_practiced: ["Escucha activa", "Validación emocional", "Trabajo con duelo"],
  system_prompt: SYSTEM_PROMPT,
  is_active: false,           // BORRADOR — fuera del catálogo hasta revisión
};

const { data: yaExiste } = await s
  .from("ai_patients")
  .select("id, is_active")
  .eq("name", PACIENTE.name)
  .maybeSingle();

console.log(`Paciente: ${PACIENTE.name} · ${PACIENTE.difficulty_level} · ${PACIENTE.tags.join(", ")}`);
console.log(`  cuadro     : ${PACIENTE.presenting_problem}`);
console.log(`  competencias: ${PACIENTE.skills_practiced.join(", ")}`);
console.log(`  prompt      : ${SYSTEM_PROMPT.length} caracteres`);
console.log(`  is_active   : ${PACIENTE.is_active}  (borrador: fuera del catálogo)`);
console.log();
console.log("PENDIENTE DE REVISIÓN POR UNA PERSONA PERUANA:");
console.log("  · el registro y los modismos (¿suena a alguien real o a un genérico con acento?)");
console.log("  · el oficio y el barrio");
console.log("  · si el duelo y la culpa son verosímiles en ese contexto");
console.log("  · si el nombre y el apellido son coherentes entre sí y con el estrato");
console.log();

if (yaExiste) {
  console.log(`ya existe (${yaExiste.id}, activo=${yaExiste.is_active}). No se toca.`);
  process.exit(0);
}
if (!ESCRIBIR) {
  console.log("ENSAYO — no se escribió nada. Para crear el borrador: --write");
  process.exit(0);
}

const { data, error } = await s.from("ai_patients").insert(PACIENTE).select("id").single();
if (error) {
  console.error("falló la creación:", error.message);
  process.exit(1);
}
console.log(`BORRADOR CREADO: ${data.id}`);
console.log(`  Para revisarlo (como docente/admin): /chat/${data.id}`);
console.log("  El estudiante no lo ve en el catálogo ni puede abrirlo por URL.");
