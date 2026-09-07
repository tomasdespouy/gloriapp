/**
 * Aviso al estudiante: dejó una sesión sin cerrar y por eso no recibió su
 * retroalimentación.
 *
 * OJO con el nombre del botón. En el chat, arriba a la derecha, el botón rojo
 * dice "Finalizar sesión". El menú de perfil, también arriba a la derecha,
 * tiene otro botón rojo que dice "Cerrar sesión" y sirve para SALIR de la
 * plataforma. Si este correo dijera "cerrar sesión", una parte de los
 * estudiantes apretaría el equivocado y saldría sin cerrar nada. Por eso acá
 * se nombra el botón por su etiqueta real y se aclara que no es el de salir.
 *
 * La plantilla la usan el cron de recordatorios y el envío puntual a una
 * cohorte, para que ambos digan exactamente lo mismo.
 *
 * ESTE ARCHIVO NO IMPORTA NADA, y tiene que seguir así. scripts/recordar-
 * sesiones-sin-cerrar.js lo carga directo con el type-stripping de Node para
 * no tener una segunda copia del HTML que se desincronice en silencio. Un
 * import con alias @/ rompería esa carga. Por eso appUrl y logoUrl entran
 * como parámetros en vez de resolverse acá adentro.
 */

export type UnclosedSessionEmail = {
  studentName: string;
  patientName: string;
  /** Fecha de la sesión en ISO; se muestra para que reconozca cuál es. */
  sessionDate: string;
  messageCount: number;
  /** Dominio canónico, p. ej. https://www.glor-ia.com */
  appUrl: string;
  /** URL absoluta del logo para el encabezado del correo. */
  logoUrl: string;
};

const TZ = "America/Santiago";

export function unclosedSessionSubject(patientName: string): string {
  return `Tu sesión con ${patientName} quedó sin cerrar`;
}

export function unclosedSessionHtml(o: UnclosedSessionEmail): string {
  const { appUrl, logoUrl } = o;
  const fecha = new Date(o.sessionDate).toLocaleDateString("es-CL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const primerNombre = (o.studentName || "").trim().split(/\s+/)[0] || "";

  return `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <div style="background: #4A55A2; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="color: white; margin: 0; font-size: 22px;">Te falta un paso</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px;">
              Tu sesión quedó abierta y sin retroalimentación
            </p>
          </div>
          <img src="${logoUrl}" alt="GlorIA" width="120" height="40" style="height: 40px; width: auto; display: block;" />
        </div>
      </div>

      <div style="background: #FAFAFA; padding: 32px; border: 1px solid #E5E5E5; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 15px; color: #333; margin: 0 0 16px;">
          Hola${primerNombre ? ` <strong>${primerNombre}</strong>` : ""},
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;">
          El <strong>${fecha}</strong> tuviste una conversación de ${o.messageCount} mensajes con
          <strong>${o.patientName}</strong>. Está guardada completa, no perdiste nada.
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 20px;">
          Pero la sesión quedó abierta: saliste sin finalizarla. La retroalimentación sobre
          tus competencias solo se genera cuando la cierras, así que todavía no la tienes.
          Son dos minutos.
        </p>

        <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px 24px; margin: 0 0 22px;">
          <p style="margin: 0 0 14px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
            Cómo cerrarla
          </p>
          <ol style="font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li>Entra a GlorIA y anda a <strong>Historial</strong>.</li>
            <li>Toca la sesión con ${o.patientName} y aprieta <strong>Retomar</strong>.</li>
            <li>
              Ya en la conversación, arriba a la derecha, aprieta el botón rojo que dice
              <strong>Finalizar sesión</strong>.
            </li>
            <li>Responde la autorreflexión breve que aparece.</li>
          </ol>
        </div>

        <div style="background: #FFF7ED; border-left: 4px solid #F59E0B; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 0 0 24px;">
          <p style="font-size: 13px; color: #92400E; margin: 0; line-height: 1.5;">
            No confundas ese botón con el <strong>Cerrar sesión</strong> del menú de tu perfil:
            ese te saca de la plataforma y deja la sesión igual de abierta. El que necesitas
            dice <strong>Finalizar sesión</strong> y está dentro de la conversación.
          </p>
        </div>

        <div style="text-align: center; margin: 0 0 8px;">
          <a href="${appUrl}/historial"
             style="display: inline-block; background: #4A55A2; color: white; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
            Ir a mi historial
          </a>
        </div>

        <div style="margin-top: 28px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="font-size: 14px; color: #333; margin: 0; font-weight: 700;">Equipo GlorIA</p>
          <p style="font-size: 12px; color: #999; margin: 4px 0 0;">
            ¿Problemas para entrar? Escríbenos a info@glor-ia.com
          </p>
        </div>
      </div>

      <div style="text-align: center; padding: 16px 0; font-size: 11px; color: #bbb;">
        GlorIA — Simulación clínica con inteligencia artificial
      </div>
    </div>
  `;
}
