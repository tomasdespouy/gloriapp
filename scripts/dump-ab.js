// READ-ONLY. Imprime, para un paciente, la corrida 1 de A(viejo) vs B(enriq.):
// la intervención del terapeuta (abreviada) y la respuesta del paciente.
const fs = require("fs");
const R = JSON.parse(fs.readFileSync("scripts/ab-results.json", "utf8"));
const want = (process.argv[2] || "").toLowerCase();
const ab = (s) => (s || "").replace(/\s+/g, " ").slice(0, 70);
for (const r of R) {
  if (want && !r.name.toLowerCase().includes(want)) continue;
  const A = r.runsA[0], B = r.runsB[0];
  const hA = r.heatA[0], hB = r.heatB[0];
  console.log(`\n\n=================== ${r.name} ===================`);
  for (let i = 0; i < A.length; i += 2) {
    const t = i / 2;
    console.log(`\nT${t + 1} ⟶ ${ab(A[i].content)}`);
    console.log(`  A: [${hA[t]?.category}/${hA[t]?.intensity}] ${A[i + 1].content.replace(/\s+/g, " ")}`);
    console.log(`  B: [${hB[t]?.category}/${hB[t]?.intensity}] ${B[i + 1].content.replace(/\s+/g, " ")}`);
  }
}
