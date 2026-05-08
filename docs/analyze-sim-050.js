/**
 * Análisis post-simulación: uso de elementos del prompt enriquecido,
 * diversidad léxica, dialectalismos.
 */
const fs = require("fs");

const SIM = JSON.parse(fs.readFileSync("C:/tmp/sim-050.json", "utf8"));
const ENRICHED = JSON.parse(fs.readFileSync("C:/tmp/enriched-blocks.json", "utf8"));
const PATIENTS = JSON.parse(fs.readFileSync("C:/tmp/all-patients.json", "utf8"));

// Stopwords y palabras genéricas a ignorar al extraer nombres
const STOP = new Set(["RED","SOCIAL","Y","VÍNCULOS","LUGARES","SIGNIFICATIVOS","ESTADO","CORPORAL","RUTINA","FRASES","TIPO","QUE","DICES",
  "El","La","Los","Las","Un","Una","De","Del","En","A","Y","O","Que","Su","Sus","Mi","Mis","Tu","Tus","Para","Con","Sin","Por","Se","Si","No",
  "Es","Son","Está","Estás","Hay","Tiene","Tienes","Puede","Solo","Sólo","Como","Pero","Porque","Cuando","Donde","Aunque","También","Más","Menos",
  "Hace","Hago","Voy","Casa","Casi","Cuándo","Después","Antes","Hoy","Ayer","Veces","Día","Días","Año","Años","Mes","Meses","Semana","Mañana","Noche","Tarde","Vez","Quién","Cómo","Vida","Trabajo","Familia","Amigos","Amiga","Amigo"]);

// Extraer "nombres propios" candidatos del bloque enriquecido
// Heurística simple: palabras capitalizadas dentro de los bloques que no sean stopwords
function extractEntities(blocks) {
  const text = Object.values(blocks).join(" ");
  const tokens = text.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/g) || [];
  const ents = new Set();
  for (const t of tokens) {
    if (!STOP.has(t) && t.length >= 4) ents.add(t);
  }
  return Array.from(ents);
}

// Dialectalismos por país
const DIALECT_MARKERS = {
  "Chile": ["cachai","cachan","caché","poh","pucha","filo","onda","weón","weon","hueón","hueon","carrete","fome","ya po","cabro","chiquillos","chiquilla","altiro"],
  "Perú": [" pe ","pues","oe","ya pe","de cajón","jato","chamba","plata","yapa","huevón","jodido","manyas","manya"],
  "Colombia": ["parcero","parcera","vea","pues","mero","hijuepu","verraco","bacano","chimba","chévere","ñero","gonorrea"],
  "México": ["órale","ándale","wey","güey","cabrón","mero","chido","padrísimo","neta","chingón","chamaco","mande","ahorita"],
  "Argentina": ["che","dale","boludo","mina","piba","laburo","bárbaro","posta","quilombo","chabón","viste","entendés","sentís","tenés","podés","querés"],
  "República Dominicana": ["vaina","tigueraje","tíguere","manín","loco","manito","mamita","papito","klk","ta bien","ta to","e' verdad","e' que","apoyate"],
};

function dialectScore(text, country) {
  const markers = DIALECT_MARKERS[country] || [];
  const lc = text.toLowerCase();
  let count = 0;
  for (const m of markers) {
    const re = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = lc.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

const rows = [];
for (const r of SIM.patients) {
  if (r.error) continue;
  const enriched = ENRICHED.patients.find(e => e.id === r.id);
  const entities = extractEntities(enriched.enriched_blocks);

  const origText = r.original_turns.map(t => t.reply).join(" ");
  const enriText = r.enriched_turns.map(t => t.reply).join(" ");

  const origEnts = entities.filter(e => origText.includes(e));
  const enriEnts = entities.filter(e => enriText.includes(e));

  const origLen = origText.length;
  const enriLen = enriText.length;

  const origDialect = dialectScore(origText, r.country);
  const enriDialect = dialectScore(enriText, r.country);

  // Diversidad léxica: tokens únicos / total
  const origTokens = origText.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const enriTokens = enriText.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const origDiv = origTokens.length ? new Set(origTokens).size / origTokens.length : 0;
  const enriDiv = enriTokens.length ? new Set(enriTokens).size / enriTokens.length : 0;

  rows.push({
    name: r.name,
    country: r.country,
    difficulty: r.difficulty,
    age: r.age,
    chars_orig: origLen,
    chars_enri: enriLen,
    delta_chars_pct: ((enriLen - origLen) / origLen * 100).toFixed(0),
    avg_orig: Math.round(origLen / 15),
    avg_enri: Math.round(enriLen / 15),
    entities_total: entities.length,
    entities_used_orig: origEnts.length,
    entities_used_enri: enriEnts.length,
    entities_orig_pct: ((origEnts.length / entities.length) * 100).toFixed(0),
    entities_enri_pct: ((enriEnts.length / entities.length) * 100).toFixed(0),
    new_entities_in_enri: enriEnts.filter(e => !origEnts.includes(e)),
    dialect_orig: origDialect,
    dialect_enri: enriDialect,
    diversity_orig: origDiv.toFixed(3),
    diversity_enri: enriDiv.toFixed(3),
  });
}

console.log("\n=== Tabla resumen ===");
console.log("Paciente               País  Dif    Δchars  EntsO/E    Dialect O/E");
console.log("─".repeat(80));
for (const r of rows) {
  console.log(
    `${r.name.padEnd(22)} ${r.country.slice(0,3)} ${r.difficulty.slice(0,4).padEnd(4)} ${
      (r.delta_chars_pct + "%").padStart(6)} ${
      (r.entities_used_orig + "/" + r.entities_used_enri + " (de " + r.entities_total + ")").padEnd(15)} ${
      r.dialect_orig + "/" + r.dialect_enri}`
  );
}

// Promedios
const avg = (k) => (rows.reduce((s, r) => s + Number(r[k]), 0) / rows.length).toFixed(1);
console.log("\n=== Promedios ===");
console.log(`Δ chars promedio:        ${avg('delta_chars_pct')}%`);
console.log(`Entidades usadas orig:   ${avg('entities_used_orig')} de ~${avg('entities_total')}`);
console.log(`Entidades usadas enri:   ${avg('entities_used_enri')} de ~${avg('entities_total')}`);
console.log(`Dialect markers orig:    ${avg('dialect_orig')}`);
console.log(`Dialect markers enri:    ${avg('dialect_enri')}`);
console.log(`Diversidad léxica orig:  ${avg('diversity_orig')}`);
console.log(`Diversidad léxica enri:  ${avg('diversity_enri')}`);

// Ranking de pacientes por mejora en uso de entidades
console.log("\n=== Top 5 mejoras en uso de entidades del prompt ===");
const sorted = [...rows].sort((a,b) => (b.entities_used_enri - b.entities_used_orig) - (a.entities_used_enri - a.entities_used_orig));
for (const r of sorted.slice(0,5)) {
  console.log(`  ${r.name.padEnd(22)} ${r.entities_used_orig} → ${r.entities_used_enri} (+${r.entities_used_enri-r.entities_used_orig})`);
}

fs.writeFileSync("C:/tmp/sim-050-analysis.json", JSON.stringify({rows, generated_at: new Date().toISOString()}, null, 2));
console.log("\n✓ Guardado en C:/tmp/sim-050-analysis.json");
