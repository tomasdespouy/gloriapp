// READ-ONLY. Dump A vs B (corrida 1) desde un *-conductual.json.
const fs = require("fs");
const R = JSON.parse(fs.readFileSync(process.argv[2] || "scripts/pilot-enriched-batch2-conductual.json", "utf8"));
const want = (process.argv[3] || "").toLowerCase();
const norm = (x) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ab = (s) => (s || "").replace(/\s+/g, " ").slice(0, 64);
for (const r of R) {
  if (want && !norm(r.name).includes(want)) continue;
  const A = r.runA0, B = r.runB0, hA = r.heatA[0], hB = r.heatB[0];
  console.log(`\n=========== ${r.name}  (A=${r.dA.indice} → B=${r.dB.indice}) ===========`);
  for (let i = 0; i < A.length; i += 2) {
    const t = i / 2;
    console.log(`\nT${t + 1} ⟶ ${ab(A[i].content)}`);
    console.log(`  A [${hA[t]?.category}/${hA[t]?.intensity}]: ${A[i + 1].content.replace(/\s+/g, " ")}`);
    console.log(`  B [${hB[t]?.category}/${hB[t]?.intensity}]: ${B[i + 1].content.replace(/\s+/g, " ")}`);
  }
}
