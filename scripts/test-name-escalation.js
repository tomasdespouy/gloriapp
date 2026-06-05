// Validates buildNameEscalation gating + buildClosingAppointmentRule.
const stripAccents = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function hasStudentIntroducedName(messages) {
  for (const msg of messages) {
    if (/\bme\s+llamo\s+\S/i.test(msg)) return true;
    if (/\bmi\s+nombre\s+es\s+\S/i.test(msg)) return true;
    if (/\baqu[ií]\s+(?:le\s+)?habla\s+\S/i.test(msg)) return true;
    if (/\b[Ss]oy\s+(?:el\s+|la\s+)?(?:doctor[ae]?\s+|psic[oó]log[ao]\s+|terapeuta\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(msg)) return true;
  }
  return false;
}
const INSIST_GRACE = 2;
function buildNameEscalation(profile, turnNumber, sessionNumber, studentMessages) {
  const intro = profile.introductionProtocol;
  if (!intro) return { rule: "", rupture: false };
  if (sessionNumber != null && sessionNumber !== 1) return { rule: "", rupture: false };
  if (hasStudentIntroducedName(studentMessages)) return { rule: "", rupture: false };
  const ask = intro.askNameAtTurn;
  if (turnNumber <= ask) return { rule: "", rupture: false };
  if (turnNumber <= ask + INSIST_GRACE) return { rule: "INSIST", rupture: false };
  return { rule: "RUPTURE", rupture: true };
}
const CLOSING_RE = /\b(nos vemos|hasta (la proxima|luego|pronto|el)|me despido|eso ser[ií]a (todo|por hoy)|terminemos|cerremos|seguimos (la proxima|el)|gracias por (hoy|la sesion|venir)|nos vemos la proxima|que (tenga|tengas) (buen|buena)|chao|cha[uo]|adi[oó]s|hasta el)\b/i;
const DATE_RE = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|pasado ma[ñn]ana|\d{1,2}\s*(de|\/|-)\s*\w+|a las\s*\d|\d{1,2}\s*(am|pm|hrs|hr|h\b))\b/i;
function buildClosingAppointmentRule(userMessages) {
  const closing = userMessages.some((m) => CLOSING_RE.test(stripAccents(m)));
  if (!closing) return "";
  if (userMessages.some((m) => DATE_RE.test(stripAccents(m)))) return "";
  return "ASK";
}

const P = { introductionProtocol: { askNameAtTurn: 3 } }; // conversational_medium
let pass = 0, fail = 0;
const eq = (l, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); console.log(`${ok ? "PASS" : "FAIL"}  ${l} -> ${JSON.stringify(g)}`); ok ? pass++ : fail++; };

console.log("== buildNameEscalation (ask=3, sin nombre, sesión 1) ==");
eq("turn 3 (= ask)", buildNameEscalation(P, 3, 1, ["hola"]).rule, "");
eq("turn 4 insiste", buildNameEscalation(P, 4, 1, ["hola"]).rule, "INSIST");
eq("turn 5 insiste", buildNameEscalation(P, 5, 1, ["hola"]).rule, "INSIST");
eq("turn 6 QUIEBRE", buildNameEscalation(P, 6, 1, ["hola"]), { rule: "RUPTURE", rupture: true });
eq("nombre dado → none", buildNameEscalation(P, 6, 1, ["hola", "soy Tomás"]).rule, "");
eq("sesión 2 → none", buildNameEscalation(P, 6, 2, ["hola"]).rule, "");
eq("'doctor' NO cuenta como nombre → quiebre", buildNameEscalation(P, 6, 1, ["hola doctor"]).rupture, true);

console.log("\n== buildClosingAppointmentRule ==");
eq("'nos vemos la proxima' sin fecha → ASK", buildClosingAppointmentRule(["bueno, nos vemos la próxima"]), "ASK");
eq("'gracias por hoy, hasta luego' → ASK", buildClosingAppointmentRule(["gracias por hoy, hasta luego"]), "ASK");
eq("'nos vemos el jueves a las 12' → none", buildClosingAppointmentRule(["nos vemos el jueves a las 12"]), "");
eq("'hasta el lunes' (tiene día) → none", buildClosingAppointmentRule(["hasta el lunes entonces"]), "");
eq("'cuénteme más' (no cierre) → none", buildClosingAppointmentRule(["cuénteme más sobre eso"]), "");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
