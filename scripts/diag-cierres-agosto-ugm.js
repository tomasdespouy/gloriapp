// READ-ONLY: inventario de sesiones donde el PACIENTE cerró (retiro) en agosto,
// separando las tres vías: hostilidad, evasión de nombre y antiprofesional.
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const cfg = dotenv.parse(fs.readFileSync(".env.production", "utf8").replace(/^﻿/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const DIRECTED_THREAT_RE =
  /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;
// Huella textual de un cierre del paciente (cualquiera de las 3 vías)
const CIERRE = /(prefiero (terminar|dejar|no seguir)|no me siento segur|no voy a seguir|terminar (la sesi[oó]n )?ac[aá]|dejar la sesi[oó]n|no me parece serio|hasta ac[aá]|no me siento en confianza|sin saber con qui[eé]n)/i;

const DESDE = process.argv[2] || "2026-08-01";

(async () => {
  const { data: convs } = await s
    .from("conversations")
    .select("id, student_id, ai_patient_id, status, session_number, created_at, unprofessional_count")
    .gte("created_at", DESDE)
    .order("created_at");
  console.log(`Conversaciones desde ${DESDE}: ${convs.length}\n`);

  let cerradasPorPaciente = 0;
  for (const c of convs) {
    const { data: msgs } = await s
      .from("messages").select("role, content").eq("conversation_id", c.id).order("created_at");
    if (!msgs || msgs.length < 2) continue;
    const last = msgs[msgs.length - 1];
    const lastPatient = [...msgs].reverse().find((m) => m.role === "assistant");
    const huella = lastPatient && CIERRE.test(lastPatient.content);
    const amenaza = msgs.some((m) => m.role === "user" && DIRECTED_THREAT_RE.test(normalize(m.content)));
    const unprof = (c.unprofessional_count || 0) > 0;
    if (!huella && !amenaza && !unprof) continue;

    const { data: p } = await s.from("profiles").select("full_name, email, establishment_id").eq("id", c.student_id).maybeSingle();
    const { data: e } = p?.establishment_id
      ? await s.from("establishments").select("name").eq("id", p.establishment_id).maybeSingle()
      : { data: null };
    const { data: pat } = await s.from("ai_patients").select("name, difficulty_level").eq("id", c.ai_patient_id).maybeSingle();
    cerradasPorPaciente++;
    console.log(
      `${c.created_at.slice(0, 10)} | ${p?.full_name} | ${e?.name || "-"} | ${pat?.name} | s#${c.session_number} | ${msgs.length} msgs | unprof=${c.unprofessional_count || 0} | amenazaRE=${amenaza} | huellaCierre=${!!huella}`,
    );
    if (huella) console.log(`      PACIENTE: "${lastPatient.content.replace(/\n/g, " ").slice(0, 200)}"`);
    if (last.role === "user") console.log(`      (último mensaje es de la alumna — quedó sin respuesta)`);
  }
  console.log(`\nSesiones con señal de cierre/retiro: ${cerradasPorPaciente}`);
})();
