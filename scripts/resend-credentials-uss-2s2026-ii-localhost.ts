/**
 * Reenvío con disculpas a USS 2S 2026-II (19-nov-2026).
 *
 * El correo del 9-nov salió con http://localhost:3000 porque se envió desde un
 * script local y getAppUrl() caía a localhost fuera de producción (corregido en
 * src/lib/app-url.ts). Este script le manda una clave nueva + disculpas SOLO a
 * quien nunca entró: a quien ya fijó su propia clave no se le toca (rotarla lo
 * dejaría afuera).
 *
 *   npx tsx scripts/resend-credentials-uss-2s2026-ii-localhost.ts --dry
 *   npx tsx scripts/resend-credentials-uss-2s2026-ii-localhost.ts --preview=archivo.html
 *   npx tsx scripts/resend-credentials-uss-2s2026-ii-localhost.ts
 */
import fs from "fs";
import dotenv from "dotenv";

const root = "C:/Users/tomas/documents/gloriapp";
const prod = dotenv.parse(fs.readFileSync(`${root}/.env.production`, "utf8").replace(/^\uFEFF/, ""));
const local = dotenv.parse(fs.readFileSync(`${root}/.env.local`, "utf8").replace(/^\uFEFF/, ""));
Object.assign(process.env, prod, { RESEND_API_KEY: local.RESEND_API_KEY });
// Cinturón y tirantes: aunque getAppUrl() ya no cae a localhost, este envío
// no depende de eso.
process.env.NEXT_PUBLIC_APP_URL = "https://www.glor-ia.com";

const SECTION = "e8f12d93-160a-4c31-a788-aa1150f6485b"; // CEPSI USS 2S 2026-II
const DRY = process.argv.includes("--dry");
const PREVIEW = process.argv.find((a) => a.startsWith("--preview="))?.split("=")[1];

export const DISCULPAS =
  "Te pedimos disculpas: el correo con tus credenciales que te enviamos el 9 de noviembre " +
  "traía un enlace equivocado (http://localhost:3000) que no lleva a la plataforma. El error fue nuestro.\n\n" +
  "La dirección correcta es https://www.glor-ia.com. Usa la contraseña de este correo para ingresar.";

(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { issueCredentials } = await import("@/lib/credentials/issue");
  const { loadLastSignIn } = await import("@/lib/credentials/eligibility");
  const { renderCredentialsEmail } = await import("@/lib/emails/credentials-template");

  if (PREVIEW) {
    const { subject, html } = renderCredentialsEmail({
      variant: "recordatorio", fullName: "Carla Andrea Fernández Salgado", email: "cfernandezs5@correo.uss.cl",
      tempPassword: "Gloria_XXXXXX", institutionName: "Universidad San Sebastián", customIntro: DISCULPAS,
    });
    fs.writeFileSync(PREVIEW, `<!-- ${subject} -->\n${html}`);
    console.log(`Asunto: ${subject}\nVista previa: ${PREVIEW}`);
    return;
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: actor } = await admin.from("profiles").select("id, role").eq("email", "tomas.despouy@ugm.cl").single();
  if (!actor || actor.role !== "superadmin") throw new Error("No se encontró el superadmin actor");

  const { data: students, error } = await admin
    .from("profiles")
    .select("id, email, full_name, is_disabled, password_set_at")
    .eq("section_id", SECTION)
    .eq("role", "student")
    .order("full_name");
  if (error) throw error;
  const ls = await loadLastSignIn(admin, students!.map((s) => s.id));

  const targets = students!.filter((s) => {
    const skip = s.is_disabled ? "desactivada" : s.password_set_at ? "clave propia" : ls.get(s.id) ? "ya ingresó" : null;
    console.log(`${skip ? "OMITIR (" + skip + ")" : "ENVIAR"}  ${s.full_name} <${s.email}>`);
    return !skip;
  });
  console.log(`\n${targets.length} de ${students!.length} a enviar${DRY ? " (dry run)" : ""}\n`);
  if (DRY) return;

  for (const s of targets) {
    const r = await issueCredentials(admin, {
      userId: s.id, actorId: actor.id, via: "manual", variant: "recordatorio",
      customIntro: DISCULPAS, idempotencyKey: `uss-2s2026ii-fix-localhost-${s.id}`,
    });
    console.log(`${r.emailSent ? "OK   " : "FALLÓ"} ${s.email}${r.error ? " — " + r.error : ""}`);
    await new Promise((res) => setTimeout(res, 700));
  }
})().catch((e) => { console.error(e); process.exit(1); });
