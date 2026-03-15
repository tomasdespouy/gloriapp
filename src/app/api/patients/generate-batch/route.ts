import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chat } from "@/lib/ai";

const COUNTRY_PROFILES: Record<string, { demonym: string; cities: string[]; names_m: string[]; names_f: string[]; surnames: string[]; cultural_notes: string }> = {
  Chile: {
    demonym: "chileno/a",
    cities: ["Santiago", "Valparaíso", "Concepción", "Temuco", "Antofagasta", "La Serena", "Punta Arenas", "Rancagua", "Chiloé", "Arica"],
    names_m: ["Sebastián", "Matías", "Felipe", "Cristóbal", "Andrés", "Diego"],
    names_f: ["Catalina", "Francisca", "Valentina", "Javiera", "Camila", "Fernanda"],
    surnames: ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Figueroa"],
    cultural_notes: "Cultura chilena con modismos locales, cachai, po, weón (informal). Contexto post-estallido social, sistema de salud mixto (Fonasa/Isapre), AFP, educación universitaria cara.",
  },
  México: {
    demonym: "mexicano/a",
    cities: ["Ciudad de México", "Guadalajara", "Monterrey", "Oaxaca", "Puebla", "Mérida", "Tijuana", "Chiapas", "Querétaro", "Veracruz"],
    names_m: ["José Luis", "Carlos", "Miguel Ángel", "Juan Pablo", "Eduardo", "Ricardo"],
    names_f: ["María Fernanda", "Alejandra", "Guadalupe", "Ana Karen", "Daniela", "Sofía"],
    surnames: ["García", "Hernández", "López", "Martínez", "Rodríguez", "Flores", "Ramírez", "Torres", "Vázquez", "Moreno", "Jiménez", "Reyes"],
    cultural_notes: "Cultura mexicana con modismos (órale, mande, neta). Contexto de violencia en algunas regiones, migración interna, machismo cultural, sistema de salud IMSS/ISSSTE, fuertes lazos familiares.",
  },
  Colombia: {
    demonym: "colombiano/a",
    cities: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Santa Marta", "Manizales", "Villavicencio"],
    names_m: ["Santiago", "Andrés Felipe", "Juan Camilo", "Sebastián", "David", "Nicolás"],
    names_f: ["Laura", "Valentina", "María José", "Carolina", "Natalia", "Isabela"],
    surnames: ["Gómez", "Rodríguez", "Martínez", "García", "López", "Hernández", "Díaz", "Moreno", "Álvarez", "Romero", "Torres", "Vargas"],
    cultural_notes: "Cultura colombiana diversa por regiones (paisa, costeño, rolo, caleño). Contexto post-conflicto armado, desplazamiento forzado, narcotráfico como tema social, EPS/salud pública, parcero, bacano.",
  },
  Argentina: {
    demonym: "argentino/a",
    cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "La Plata", "Mar del Plata", "Salta", "Neuquén", "Bariloche"],
    names_m: ["Martín", "Agustín", "Tomás", "Facundo", "Nicolás", "Lautaro"],
    names_f: ["Lucía", "Valentina", "Milagros", "Camila", "Florencia", "Abril"],
    surnames: ["González", "Rodríguez", "Fernández", "López", "Martínez", "García", "Romero", "Sosa", "Álvarez", "Torres", "Díaz", "Gutiérrez"],
    cultural_notes: "Cultura argentina con voseo (vos sos, tenés). Contexto de crisis económica recurrente, inflación, psicoanálisis muy arraigado, mate, fútbol como identidad, OSDE/obras sociales.",
  },
  Perú: {
    demonym: "peruano/a",
    cities: ["Lima", "Arequipa", "Cusco", "Trujillo", "Chiclayo", "Piura", "Iquitos", "Huancayo", "Ayacucho", "Puno"],
    names_m: ["Luis Fernando", "César", "Jorge", "Renato", "Álvaro", "Diego"],
    names_f: ["María Elena", "Claudia", "Milagros", "Yuliana", "Lucía", "Paola"],
    surnames: ["García", "Quispe", "Flores", "Huamán", "Rojas", "Díaz", "Torres", "Mendoza", "Chávez", "Sánchez", "Vargas", "Castro"],
    cultural_notes: "Cultura peruana multicultural (costa, sierra, selva). Contexto de migración interna (provincias a Lima), terrorismo como trauma generacional, SIS/EsSalud, compadrazgo, pe (modismo).",
  },
  España: {
    demonym: "español/a",
    cities: ["Madrid", "Barcelona", "Sevilla", "Valencia", "Bilbao", "Málaga", "Zaragoza", "Granada", "Salamanca", "Santiago de Compostela"],
    names_m: ["Pablo", "Alejandro", "Álvaro", "Hugo", "Daniel", "Javier"],
    names_f: ["Lucía", "María", "Paula", "Elena", "Carmen", "Ana"],
    surnames: ["García", "Martínez", "López", "Sánchez", "González", "Rodríguez", "Fernández", "Pérez", "Gómez", "Díaz", "Ruiz", "Muñoz"],
    cultural_notes: "Cultura española con vosotros, tío/tía, mola, vale. Contexto de crisis inmobiliaria, desempleo juvenil, sistema de salud público (Seguridad Social), identidades regionales fuertes (catalán, vasco, andaluz).",
  },
};

const MOTIVOS = [
  "Ansiedad generalizada", "Duelo", "Depresión", "Problemas de pareja",
  "Conflicto familiar", "Estrés laboral / burnout", "Autoestima baja",
  "Aislamiento social", "Trauma / TEPT", "Manejo de ira",
  "Dependencia emocional", "Crisis de identidad",
];

const CONTEXTS = [
  "Urbano - clase media", "Urbano - clase alta", "Urbano - clase baja",
  "Rural", "Migrante", "Urbano - clase media",
];

const OCCUPATIONS = [
  "Estudiante universitario/a", "Profesor/a", "Ingeniero/a", "Enfermero/a",
  "Comerciante", "Agricultor/a", "Abogado/a", "Conductor de transporte",
  "Trabajador/a doméstico/a", "Contador/a", "Diseñador/a", "Obrero/a de construcción",
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { country } = await request.json();
  if (!country || !COUNTRY_PROFILES[country]) {
    return NextResponse.json({ error: "País no soportado" }, { status: 400 });
  }

  const profile = COUNTRY_PROFILES[country];
  const difficulties = ["beginner", "beginner", "beginner", "beginner", "intermediate", "intermediate", "intermediate", "intermediate", "advanced", "advanced", "advanced", "advanced"];

  // Generate 12 patient specs
  const patients: Array<{
    name: string; age: number; gender: string; occupation: string;
    city: string; context: string; motivo: string; difficulty: string;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const isFemale = i % 2 === 0; // Alternate: 6 women, 6 men
    const namePool = isFemale ? profile.names_f : profile.names_m;
    const name = namePool[i % namePool.length] + " " + profile.surnames[i % profile.surnames.length];
    const age = 18 + Math.floor(Math.random() * 45); // 18-62
    const city = profile.cities[i % profile.cities.length];
    const context = CONTEXTS[i % CONTEXTS.length];
    const motivo = MOTIVOS[i % MOTIVOS.length];
    const occupation = OCCUPATIONS[i % OCCUPATIONS.length];

    patients.push({
      name, age,
      gender: isFemale ? "Femenino" : "Masculino",
      occupation, city, context, motivo,
      difficulty: difficulties[i],
    });
  }

  // Generate full profiles with LLM (batch of 12 in one call for efficiency)
  const prompt = `Genera 12 perfiles clínicos completos de pacientes ficticios de ${country} para un simulador de práctica terapéutica.

CONTEXTO CULTURAL: ${profile.cultural_notes}

Para cada paciente, genera un JSON con esta estructura exacta. Responde SOLO con un JSON array válido (sin markdown, sin backticks):

${JSON.stringify(patients.map((p, i) => ({
  index: i,
  name: p.name,
  age: p.age,
  gender: p.gender,
  occupation: p.occupation,
  city: p.city,
  context: p.context,
  motivo: p.motivo,
  difficulty: p.difficulty,
})), null, 2)}

Para CADA paciente genera:
{
  "name": "nombre completo",
  "age": número,
  "gender": "Masculino/Femenino",
  "occupation": "ocupación",
  "quote": "frase característica del paciente en primera persona, que refleje su personalidad y problemática (1 oración corta)",
  "presenting_problem": "descripción breve del problema (1-2 oraciones)",
  "backstory": "historia de vida relevante (3-4 oraciones, incluir ciudad, contexto familiar, vínculos significativos)",
  "personality_traits": ["rasgo1", "rasgo2", "rasgo3"],
  "tags": ["tag1", "tag2", "tag3"],
  "difficulty_level": "beginner/intermediate/advanced",
  "system_prompt": "Prompt completo para que el LLM actúe como este paciente. Debe incluir: identidad, historia, forma de hablar según su país/región/nivel socioeconómico, defensas, qué revela y cuándo, comportamiento en sesión, lenguaje corporal entre corchetes, modismos del país. IMPORTANTE: este prompt debe ser de al menos 300 palabras y muy detallado."
}

REGLAS:
- Todos deben tener patologías/motivos DISTINTOS
- Diversidad de situaciones: migración, ruralidad, urbanismo, nivel socioeconómico
- Nombres, edad, profesión y ciudad específica del país
- Entorno familiar detallado con vínculos significativos
- Modismos y expresiones propias del país en el system_prompt
- El system_prompt debe ser extenso y detallado (mínimo 300 palabras)
- 6 mujeres y 6 hombres alternados`;

  let generatedProfiles;
  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "Eres un experto en psicología clínica y simulación de pacientes. Responde SOLO con JSON válido."
    );
    const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    generatedProfiles = JSON.parse(jsonStr);
  } catch (err) {
    return NextResponse.json({ error: "Error generando perfiles: " + (err instanceof Error ? err.message : "unknown") }, { status: 500 });
  }

  return NextResponse.json({ profiles: generatedProfiles, country });
}
