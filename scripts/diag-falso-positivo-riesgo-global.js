// READ-ONLY: busca sesiones cerradas por FALSO POSITIVO de DIRECTED_THREAT_RE,
// es decir, preguntas legítimas de tamizaje de riesgo suicida en tuteo
// ("¿has pensado en hacerte daño?", "¿te lastimas?") que el detector de
// hostilidad interpreta como amenaza dirigida y cierra la sesión.
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const DIRECTED_THREAT_RE =
  /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;

// Contexto de tamizaje clínico: la frase va precedida de verbos de exploración.
const CONTEXTO_TAMIZAJE =
  /(has? (llegado a )?(pensado|tenido)|pensamientos de|ideas de|idea de|alguna vez|te ha pasado|piensas en|ganas de|deseo de|intentado|planeado|considerado)/i;

const DESDE = process.argv[2] || "2026-06-01";

(async () => {
  const { data: convs } = await s
    .from("conversations")
    .select("id, student_id, ai_patient_id, status, session_number, created_at, ended_at")
    .gte("created_at", DESDE)
    .order("created_at");
  console.log(`Conversaciones desde ${DESDE}: ${convs.length}\n`);

  const casos = [];
  for (const c of convs) {
    const { data: msgs } = await s
      .from("messages").select("role, content, created_at").eq("conversation_id", c.id).order("created_at");
    if (!msgs || !msgs.length) continue;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== "user") continue;
      const hit = normalize(m.content).match(DIRECTED_THREAT_RE);
      if (!hit) continue;
      const tamizaje = CONTEXTO_TAMIZAJE.test(m.content);
      // ¿fue el último turno de la sesión? (la sesión murió ahí)
      const cerroSesion = i >= msgs.length - 2;
      casos.push({ c, msg: m, hit: hit[0], tamizaje, cerroSesion, idx: i, total: msgs.length });
      break;
    }
  }

  console.log(`Sesiones con disparo de DIRECTED_THREAT_RE: ${casos.length}`);
  console.log(`  · con contexto de tamizaje clínico (falso positivo): ${casos.filter((x) => x.tamizaje).length}`);
  console.log(`  · que murieron en ese turno: ${casos.filter((x) => x.cerroSesion).length}\n`);

  for (const x of casos) {
    const { data: p } = await s.from("profiles").select("full_name, email, establishment_id").eq("id", x.c.student_id).maybeSingle();
    const { data: e } = p?.establishment_id
      ? await s.from("establishments").select("name").eq("id", p.establishment_id).maybeSingle()
      : { data: null };
    const { data: pat } = await s.from("ai_patients").select("name").eq("id", x.c.ai_patient_id).maybeSingle();
    console.log(
      `${x.tamizaje ? "FALSO+" : "real? "} ${x.cerroSesion ? "[MURIÓ AHÍ]" : "[siguió]  "} ${x.c.created_at.slice(0, 10)} | ${p?.full_name} <${p?.email}> | ${e?.name || "-"} | ${pat?.name} | s#${x.c.session_number} turno ${x.idx + 1}/${x.total} | match "${x.hit}"`,
    );
    console.log(`        "${x.msg.content.replace(/\n/g, " ").slice(0, 240)}"`);
  }
})();
