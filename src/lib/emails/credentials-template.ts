/**
 * Plantilla única del correo de credenciales.
 *
 * Consolida las cuatro plantillas que existían por separado (users/create,
 * users/[id]/reset-password, pilots/[id]/send-invites y public/pilot-enroll).
 * De esas, solo pilot-enroll escapaba el HTML y solo ella mostraba el logo
 * institucional; ambas cosas se conservan aquí para todos los envíos.
 *
 * Tres variantes:
 *   bienvenida       → primera entrega (profiles.credentials_sent_at IS NULL)
 *   restablecimiento → ya había recibido credenciales antes
 *   recordatorio     → nunca usó las que le mandamos; la anterior deja de servir
 */

import { getAppUrl } from "@/lib/app-url";
import { getGloriaLogoUrl } from "@/lib/email-assets";

export type CredentialsVariant = "bienvenida" | "restablecimiento" | "recordatorio";

export interface CredentialsEmailParams {
  variant: CredentialsVariant;
  fullName: string | null;
  email: string;
  tempPassword: string;
  /** Nombre del establecimiento o programa, para la firma institucional. */
  institutionName?: string | null;
  /** Logo del establecimiento; si falta, la fila sale sin imagen. */
  institutionLogoUrl?: string | null;
  /** Párrafos libres que escribe quien agenda el envío. */
  customIntro?: string | null;
  /** ISO. Si la ventana de acceso abre más adelante, se avisa en el correo. */
  accessOpensAt?: string | null;
  /** ISO. Fin de la ventana de acceso. */
  accessClosesAt?: string | null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COPY: Record<
  CredentialsVariant,
  { subject: string; heading: string; intro: (name: string) => string; credsLabel: string }
> = {
  bienvenida: {
    subject: "Te damos la bienvenida a GlorIA — Tus credenciales de acceso",
    heading: "Te damos la bienvenida a GlorIA",
    intro: () =>
      "Se creó tu cuenta en GlorIA. Practicarás entrevistas clínicas con pacientes " +
      "virtuales y recibirás retroalimentación sobre tus competencias terapéuticas. " +
      "A continuación están tus credenciales de acceso:",
    credsLabel: "Credenciales de acceso",
  },
  restablecimiento: {
    subject: "GlorIA — Tu contraseña ha sido restablecida",
    heading: "Contraseña restablecida",
    intro: () =>
      "Un administrador restableció tu contraseña en GlorIA. La contraseña anterior " +
      "ya no funciona. A continuación están tus nuevas credenciales de acceso:",
    credsLabel: "Nuevas credenciales de acceso",
  },
  recordatorio: {
    subject: "GlorIA — Recordatorio: tu acceso sigue disponible",
    heading: "Tu acceso a GlorIA sigue disponible",
    intro: () =>
      "Notamos que todavía no has ingresado a GlorIA. Te reenviamos tus credenciales " +
      "con una contraseña nueva: <strong>la que te enviamos antes ya no funciona</strong>. " +
      "Usa la de este correo para entrar:",
    credsLabel: "Credenciales de acceso actualizadas",
  },
};

/**
 * Devuelve asunto y HTML listos para enviar. No hace I/O: es pura, así que se
 * puede comparar el HTML antes y después de un cambio sin levantar nada.
 */
export function renderCredentialsEmail(p: CredentialsEmailParams): {
  subject: string;
  html: string;
} {
  const copy = COPY[p.variant];
  const appUrl = getAppUrl();
  const loginUrl = `${appUrl}/login`;
  const logoUrl = getGloriaLogoUrl();
  const displayName = (p.fullName || "").trim() || "estudiante";

  const institutionRow = p.institutionName
    ? p.institutionLogoUrl
      ? `
        <tr>
          <td style="padding: 14px 32px 18px; border-top: 1px solid rgba(255,255,255,0.18);">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: middle; padding-right: 10px;">
                  <div style="width: 34px; height: 34px; border-radius: 17px; background: #FFFFFF; text-align: center; line-height: 0;">
                    <img src="${escapeHtml(p.institutionLogoUrl)}" alt="${escapeHtml(p.institutionName)}" style="max-width: 26px; max-height: 26px; object-fit: contain; vertical-align: middle; margin-top: 4px;" />
                  </div>
                </td>
                <td style="vertical-align: middle; font-family: Calibri, Arial, sans-serif; font-size: 12px; color: rgba(255,255,255,0.9);">
                  <strong style="color:#FFFFFF;">${escapeHtml(p.institutionName)}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : `
        <tr>
          <td style="padding: 10px 32px 14px; border-top: 1px solid rgba(255,255,255,0.18); font-family: Calibri, Arial, sans-serif; font-size: 12px; color: rgba(255,255,255,0.9);">
            <strong style="color:#FFFFFF;">${escapeHtml(p.institutionName)}</strong>
          </td>
        </tr>`
    : "";

  const customBlock = p.customIntro
    ? p.customIntro
        .split("\n\n")
        .map(
          (par) =>
            `<p style="font-size: 14px; color: #555; line-height: 1.6;">${escapeHtml(par).replace(/\n/g, "<br/>")}</p>`,
        )
        .join("")
    : "";

  const windowBlock = buildWindowBlock(p.accessOpensAt, p.accessClosesAt);

  const html = `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #4A55A2; border-radius: 12px 12px 0 0;">
        <tr>
          <td style="padding: 24px 32px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align: top;">
                  <h1 style="color: white; margin: 0; font-size: 22px; font-family: Calibri, Arial, sans-serif;">${copy.heading}</h1>
                  <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; font-family: Calibri, Arial, sans-serif;">
                    Plataforma de Entrenamiento Cl&iacute;nico con IA
                  </p>
                </td>
                <td align="right" style="vertical-align: top; width: 130px;">
                  <img src="${logoUrl}" alt="GlorIA" width="120" height="40" style="height: 40px; width: auto; display: block;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${institutionRow}
      </table>

      <div style="background: #FAFAFA; padding: 32px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #333;">Hola <strong>${escapeHtml(displayName)}</strong>,</p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">${copy.intro(displayName)}</p>

        ${customBlock}

        <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
            ${copy.credsLabel}
          </p>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 120px;">Plataforma:</td>
              <td style="padding: 8px 0;">
                <a href="${loginUrl}" style="color: #4A55A2; text-decoration: none; font-weight: 600;">${escapeHtml(appUrl)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email:</td>
              <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(p.email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Contrase&ntilde;a:</td>
              <td style="padding: 8px 0; font-weight: bold; font-family: monospace; font-size: 16px; letter-spacing: 1px; color: #4A55A2;">
                ${escapeHtml(p.tempPassword)}
              </td>
            </tr>
          </table>
        </div>

        ${windowBlock}

        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: #4A55A2; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Ingresar a GlorIA
          </a>
        </div>

        <p style="font-size: 14px; color: #555; font-weight: 600;">C&oacute;mo ingresar:</p>
        <ol style="font-size: 14px; color: #555; line-height: 2; padding-left: 20px;">
          <li>Entra a <a href="${loginUrl}" style="color: #4A55A2;">${escapeHtml(appUrl)}/login</a></li>
          <li>Escribe tu email y la contrase&ntilde;a de este correo</li>
          <li>Elige tu propia contrase&ntilde;a cuando la plataforma te lo pida</li>
        </ol>

        <div style="background: #F0F0FF; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="font-size: 13px; color: #4A55A2; margin: 0; font-weight: 600;">
            Esta contrase&ntilde;a es temporal. Al ingresar por primera vez se te pedir&aacute; elegir una propia.
          </p>
        </div>

        <div style="margin-top: 28px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 14px; color: #555; margin: 0;">Con entusiasmo,</p>
          <p style="font-size: 14px; color: #333; margin: 4px 0 0; font-weight: 700;">Equipo GlorIA</p>
          <p style="font-size: 12px; color: #999; margin: 8px 0 0;">
            Si tienes problemas para acceder, escr&iacute;benos a
            <a href="mailto:soporte@glor-ia.com" style="color: #4A55A2;">soporte@glor-ia.com</a>
          </p>
        </div>
      </div>

      <div style="text-align: center; padding: 16px 0; font-size: 11px; color: #bbb;">
        GlorIA — Simulaci&oacute;n cl&iacute;nica con inteligencia artificial
      </div>
    </div>
  `;

  return { subject: copy.subject, html };
}

/**
 * Aviso de ventana de acceso. Se muestra solo cuando aporta: si el acceso ya
 * está abierto y no tiene fecha de cierre, no hay nada que decir.
 */
function buildWindowBlock(opensAt?: string | null, closesAt?: string | null): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));

  const opensLater = opensAt && new Date(opensAt).getTime() > Date.now();
  if (!opensLater && !closesAt) return "";

  const lines: string[] = [];
  if (opensLater) lines.push(`Tu acceso se habilita el <strong>${fmt(opensAt!)}</strong>.`);
  if (closesAt) lines.push(`Estar&aacute; disponible hasta el <strong>${fmt(closesAt)}</strong>.`);

  return `
        <div style="background: #FFF7ED; border-left: 4px solid #F59E0B; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 18px 0;">
          <p style="font-size: 13px; color: #92400E; margin: 0; line-height: 1.6;">${lines.join(" ")}</p>
        </div>`;
}
