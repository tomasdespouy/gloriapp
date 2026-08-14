// READ-ONLY: compara el detector de amenaza ANTES vs DESPUÉS sobre TODOS los
// mensajes de estudiantes del histórico. Verifica dos cosas:
//   · recall  → ninguna amenaza real deja de detectarse
//   · precisión → desaparecen los falsos positivos de tamizaje clínico
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const VIEJO =
  /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;

const F = String.raw`(?:voy\s+a|vamos\s+a|quiero|queremos|pienso|deberia(?:n)?|debiera|podria)`;
const INF = String.raw`(?:matar|pegar|golpear|apu[nñ]alar|acuchillar|violar|reventar|destrozar|lastimar|hacer\s+(?:much[oí]simo\s+|mucho\s+|harto\s+)?da[nñ]o)`;
const P1 = String.raw`(?:mato|pego|golpeo|apu[nñ]alo|acuchillo|violo|reviento|destrozo|lastimo|matare|pegare|golpeare|reventare|destrozare|lastimare|hago\s+da[nñ]o|hare\s+da[nñ]o)`;
const ENC = String.raw`(?:matarte|pegarte|golpearte|apu[nñ]alarte|acuchillarte|violarte|reventarte|destrozarte|lastimarte|hacerte\s+(?:much[oí]simo\s+|mucho\s+|harto\s+)?da[nñ]o)`;
const NUEVO = new RegExp([
  String.raw`\bte\s+${F}\s+${INF}\b`,
  String.raw`\bte\s+${P1}\b`,
  String.raw`\b${F}\s+${ENC}\b`,
].join("|"), "i");

(async () => {
  let from = 0;
  const PAGE = 1000;
  let total = 0;
  const soloViejo = [];   // falsos positivos que el fix elimina
  const soloNuevo = [];   // casos que el fix agrega (no debería haber muchos)
  const ambos = [];       // amenazas reales, detectadas antes y ahora

  for (;;) {
    const { data, error } = await s
      .from("messages")
      .select("id, conversation_id, content, created_at")
      .eq("role", "user")
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); break; }
    if (!data || !data.length) break;
    total += data.length;
    for (const m of data) {
      const n = normalize(m.content || "");
      const v = VIEJO.test(n), nu = NUEVO.test(n);
      if (!v && !nu) continue;
      const row = { id: m.id, conv: m.conversation_id, fecha: m.created_at.slice(0, 10), txt: (m.content || "").replace(/\n/g, " ").slice(0, 160) };
      if (v && nu) ambos.push(row);
      else if (v) soloViejo.push(row);
      else soloNuevo.push(row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Mensajes de estudiante analizados: ${total}\n`);
  console.log(`AMBOS (amenaza real, sigue detectada): ${ambos.length}`);
  for (const r of ambos) console.log(`   ${r.fecha}  ${r.txt}`);
  console.log(`\nSOLO EL VIEJO (falsos positivos eliminados): ${soloViejo.length}`);
  for (const r of soloViejo) console.log(`   ${r.fecha}  ${r.txt}`);
  console.log(`\nSOLO EL NUEVO (casos añadidos): ${soloNuevo.length}`);
  for (const r of soloNuevo) console.log(`   ${r.fecha}  ${r.txt}`);
})();
