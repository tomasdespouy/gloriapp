// Standalone test replicating extractStudentName + detectSessionRupture
// regex logic to validate edge cases before they hit the prod chat path.

// ---- replicate normalize / buildTermRegex / findMatches ----
const normalize = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const stripAccents = normalize;
const buildTermRegex = (terms) => {
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:^|[\\s.,;:!?¡¿'"()\\[\\]-])(${esc.join("|")})(?=$|[\\s.,;:!?¡¿'"()\\[\\]-])`, "gi");
};
const findMatches = (text, regex) => {
  const n = normalize(text); const hits = new Set(); regex.lastIndex = 0; let m;
  while ((m = regex.exec(n)) !== null) hits.add(m[1]); regex.lastIndex = 0; return [...hits];
};

// ---- extractStudentName ----
const NOT_A_NAME = new Set(["chileno","chilena","peruano","peruana","argentino","argentina","colombiano","colombiana","mexicano","mexicana","boliviano","boliviana","espanol","espanola","uruguayo","uruguaya","venezolano","venezolana","ecuatoriano","ecuatoriana","paraguayo","paraguaya","estudiante","psicologo","psicologa","terapeuta","doctor","doctora","alumno","alumna","practicante","interno","interna","profesional","supervisor","supervisora","nuevo","nueva","yo"]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
function extractStudentName(messages) {
  const NAME = "([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)";
  for (const msg of messages) {
    let m;
    if ((m = msg.match(new RegExp(`\\bme\\s+llamo\\s+${NAME}`, "i")))) return cap(m[1]);
    if ((m = msg.match(new RegExp(`\\bmi\\s+nombre\\s+es\\s+${NAME}`, "i")))) return cap(m[1]);
    if ((m = msg.match(new RegExp(`\\baqu[ií]\\s+(?:le\\s+)?habla\\s+${NAME}`, "i")))) return cap(m[1]);
    if ((m = msg.match(new RegExp(`\\b[Ss]oy\\s+(?:el\\s+|la\\s+)?(?:doctor[ae]?\\s+|psic[oó]log[ao]\\s+|terapeuta\\s+)?${NAME}`)))) {
      if (!NOT_A_NAME.has(stripAccents(m[1]))) return cap(m[1]);
    }
  }
  return null;
}

// ---- detectSessionRupture ----
const DISRESPECT_TERMS = ["eres estupida","eres estupido","que estupida","que estupido","eres tonta","eres tonto","que tonta","que tonto","no sirves","no vales nada","idiota","imbecil","tarado","tarada","bruta","bruto"];
const DISRESPECT_RE = buildTermRegex(DISRESPECT_TERMS);
const DIRECTED_THREAT_RE = /\bte\s+(?:voy\s+a\s+|quiero\s+|deberia(?:n)?\s+)?(?:mat(?:ar|o)|peg(?:ar|o)|golpe(?:ar|o)|apu[nñ]al|acuchill|viol(?:ar|o)|revent|destroz|lastim|hacer\s+da[nñ]o)|\b(?:voy\s+a\s+)?(?:matarte|pegarte|golpearte|apu[nñ]alarte|violarte|lastimarte|reventarte|destrozarte|hacerte\s+da[nñ]o)\b/i;
function detectSessionRupture(text) {
  if (!text) return { rupture: false, reason: "" };
  const n = normalize(text);
  DIRECTED_THREAT_RE.lastIndex = 0;
  const threat = n.match(DIRECTED_THREAT_RE);
  if (threat) return { rupture: true, reason: `directed_threat: ${threat[0].trim()}` };
  const dis = findMatches(text, DISRESPECT_RE);
  if (dis.length) return { rupture: true, reason: `disrespect: ${dis.join(", ")}` };
  return { rupture: false, reason: "" };
}

// ---- assertions ----
let pass = 0, fail = 0;
const eq = (label, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); console.log(`${ok ? "PASS" : "FAIL"}  ${label}  -> ${JSON.stringify(got)}`); ok ? pass++ : fail++; };

console.log("== extractStudentName ==");
eq("'Hola, soy Tomás'", extractStudentName(["Hola, soy Tomás"]), "Tomás");
eq("'me llamo Isidora'", extractStudentName(["me llamo Isidora"]), "Isidora");
eq("'Mi nombre es Carla González'", extractStudentName(["Mi nombre es Carla González"]), "Carla");
eq("'Soy la psicóloga Valentina'", extractStudentName(["Soy la psicóloga Valentina"]), "Valentina");
eq("'soy chilena' (no name)", extractStudentName(["soy chilena"]), null);
eq("'Soy Chilena' cap (no name)", extractStudentName(["Soy Chilena"]), null);
eq("'soy estudiante' (no name)", extractStudentName(["Buenas, soy estudiante"]), null);
eq("'hola cómo está' (none)", extractStudentName(["hola cómo está"]), null);
eq("burst picks first", extractStudentName(["hola", "me llamo Pedro"]), "Pedro");

console.log("\n== detectSessionRupture ==");
eq("'te voy a matar'", detectSessionRupture("te voy a matar").rupture, true);
eq("'TE VOY A MATAR' caps", detectSessionRupture("TE VOY A MATAR").rupture, true);
eq("'voy a matarte'", detectSessionRupture("voy a matarte").rupture, true);
eq("'te voy a pegar'", detectSessionRupture("te voy a pegar").rupture, true);
eq("'eres un idiota'", detectSessionRupture("eres un idiota").rupture, true);
eq("'no sirves para nada'", detectSessionRupture("no sirves para nada").rupture, true);
eq("CLINICAL 'su esposo la quiso matar' (NO)", detectSessionRupture("su esposo la quiso matar").rupture, false);
eq("CLINICAL 'pensé en matar el tiempo' (NO)", detectSessionRupture("a veces quiero matar el tiempo").rupture, false);
eq("'cómo se siente usted' (NO)", detectSessionRupture("cómo se siente usted hoy").rupture, false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
