// READ-ONLY. Imprime el system_prompt COMPLETO de pacientes nombrados,
// para comparar la estructura de los "ricos" vs los "planos".
const fs = require("fs");
const P = JSON.parse(fs.readFileSync("scripts/patologias-export.json", "utf8"));
const want = process.argv.slice(2).map((s) => s.toLowerCase());
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
for (const p of P) {
  if (!want.some((w) => norm(p.name).includes(w))) continue;
  console.log(`\n\n################## ${p.name} (${p.difficulty_level}) ##################`);
  console.log(`presenting_problem: ${p.presenting_problem}`);
  console.log(`backstory: ${p.backstory}`);
  console.log(`distinctive_factor: ${p.distinctive_factor || "(null)"}`);
  console.log(`--- system_prompt (${(p.system_prompt || "").length} chars) ---`);
  console.log(p.system_prompt);
}
