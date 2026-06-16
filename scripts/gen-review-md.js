// Genera scripts/REVISION-enriquecidos.md: paquete de muestreo humano con los
// 11 pacientes enriquecidos (batch 1 + batch 2) en formato antes/después.
const fs = require("fs");
const OLD = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8"));
const oldBy = Object.fromEntries(OLD.map((p) => [p.name, p]));
const NEW = [...require("./pilot-enriched.js"), ...require("./pilot-enriched-batch2.js")];

let md = `# Revisión de pacientes enriquecidos — antes / después\n\n`;
md += `Paquete de muestreo clínico. ${NEW.length} pacientes. Revisa el contenido y marca lo que quieras ajustar.\n\n---\n\n`;

for (const np of NEW) {
  const op = oldBy[np.name] || {};
  md += `## ${np.name} (${np.difficulty_level})\n\n`;
  md += `**Motivo de consulta**\n`;
  md += `- ANTES: ${op.presenting_problem || "—"}\n`;
  md += `- DESPUÉS: ${np.presenting_problem}\n\n`;
  md += `**Backstory**\n`;
  md += `- ANTES: ${/generad[oa] autom/i.test(op.backstory || "") ? "_(Generado automáticamente — vacío)_" : (op.backstory || "—")}\n`;
  md += `- DESPUÉS: ${np.backstory}\n\n`;
  md += `**Factor distintivo (nuevo):** ${np.distinctive_factor}\n\n`;
  md += `<details><summary>System prompt enriquecido completo</summary>\n\n\`\`\`\n${np.system_prompt}\n\`\`\`\n\n</details>\n\n---\n\n`;
}

fs.writeFileSync("scripts/REVISION-enriquecidos.md", md);
console.log(`Escrito scripts/REVISION-enriquecidos.md (${NEW.length} pacientes, ${Math.round(md.length / 1024)} KB)`);
