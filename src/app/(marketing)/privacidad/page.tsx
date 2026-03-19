import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Pol\u00edtica de Privacidad \u2014 GlorIA",
  description: "Pol\u00edtica de privacidad y protecci\u00f3n de datos personales de la plataforma GlorIA.",
};

export default async function PrivacidadPage() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-[#FAFAFA] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pol&iacute;tica de Privacidad</h1>
          <p className="text-sm text-gray-400 mb-10">&Uacute;ltima actualizaci&oacute;n: 18 de marzo de 2026</p>

          <div className="prose prose-sm prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Responsable del tratamiento</h2>
              <p>
                La plataforma GlorIA es operada por la Universidad Gabriela Mistral (en adelante, &quot;UGM&quot;), con domicilio en Av. Ricardo Lyon 1177, Providencia, Santiago, Chile. Para consultas sobre protecci&oacute;n de datos, puedes escribir a <strong>gloria@ugm.cl</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">2. Datos que recopilamos</h2>
              <p>Recopilamos las siguientes categor&iacute;as de datos personales:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Datos de registro:</strong> nombre completo, correo electr&oacute;nico institucional, rol (estudiante/docente).</li>
                <li><strong>Datos acad&eacute;micos:</strong> instituci&oacute;n, asignatura, secci&oacute;n, progreso en la plataforma (sesiones, evaluaciones, XP).</li>
                <li><strong>Contenido de sesiones:</strong> mensajes de texto intercambiados con los pacientes simulados por IA durante las sesiones de pr&aacute;ctica cl&iacute;nica.</li>
                <li><strong>Transcripciones de voz:</strong> cuando utilizas el modo voz, el navegador convierte tu voz a texto localmente. GlorIA recibe y almacena &uacute;nicamente la transcripci&oacute;n de texto resultante, no la grabaci&oacute;n de audio.</li>
                <li><strong>Datos de uso:</strong> tiempo de sesi&oacute;n, frecuencia de uso, interacciones con la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">3. Finalidad del tratamiento</h2>
              <p>Utilizamos tus datos personales para las siguientes finalidades:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Proveer el servicio de pr&aacute;ctica cl&iacute;nica con pacientes simulados por IA.</li>
                <li>Generar evaluaciones y retroalimentaci&oacute;n sobre competencias cl&iacute;nicas.</li>
                <li>Facilitar el seguimiento acad&eacute;mico por parte de tu instituci&oacute;n educativa.</li>
                <li>Mejorar la calidad de la plataforma y la experiencia de aprendizaje.</li>
                <li>Comunicaciones relacionadas con el servicio (invitaciones, notificaciones).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">4. Base legal del tratamiento</h2>
              <p>
                El tratamiento de tus datos se fundamenta en las siguientes bases legales, conforme a la Ley 19.628 sobre Protecci&oacute;n de la Vida Privada y la Ley 21.719 que la modifica:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Consentimiento:</strong> al crear tu cuenta y aceptar estos t&eacute;rminos, consientes el tratamiento de tus datos para las finalidades indicadas.</li>
                <li><strong>Ejecuci&oacute;n contractual:</strong> el tratamiento es necesario para prestarte el servicio educativo contratado.</li>
                <li><strong>Inter&eacute;s leg&iacute;timo:</strong> para mejorar la plataforma y garantizar su seguridad.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">5. Modo voz y reconocimiento de habla</h2>
              <p>
                El modo voz utiliza la API de reconocimiento de voz del navegador (Web Speech API). El procesamiento de audio se realiza localmente en tu dispositivo o por el proveedor del navegador (por ejemplo, Google en Chrome). GlorIA no graba, almacena ni transmite audio. Solo recibimos la transcripci&oacute;n de texto resultante, que se env&iacute;a directamente como mensaje al paciente simulado sin posibilidad de edici&oacute;n previa.
              </p>
              <p>
                Antes de activar el modo voz, se te solicitar&aacute; consentimiento expl&iacute;cito. Puedes desactivarlo en cualquier momento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">6. Inteligencia artificial y decisiones automatizadas</h2>
              <p>
                GlorIA utiliza modelos de inteligencia artificial (OpenAI GPT-4o y Google Gemini) para simular pacientes y generar evaluaciones de competencias cl&iacute;nicas. Estas evaluaciones son orientativas y de car&aacute;cter pedag&oacute;gico; no constituyen diagn&oacute;sticos cl&iacute;nicos ni evaluaciones acad&eacute;micas definitivas.
              </p>
              <p>
                Conforme a la Ley 21.719, tienes derecho a oponerte a decisiones basadas &uacute;nicamente en tratamiento automatizado que te afecten significativamente, y a solicitar intervenci&oacute;n humana en la revisi&oacute;n de evaluaciones generadas por IA.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">7. Compartici&oacute;n de datos con terceros</h2>
              <p>Compartimos datos personales con los siguientes terceros, exclusivamente para las finalidades descritas:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Tu instituci&oacute;n educativa:</strong> datos de progreso y evaluaciones, para fines acad&eacute;micos.</li>
                <li><strong>OpenAI / Google:</strong> el contenido de los mensajes se env&iacute;a a estos proveedores de IA para generar las respuestas de los pacientes simulados. Estos proveedores act&uacute;an como encargados de tratamiento.</li>
                <li><strong>Supabase (AWS):</strong> alojamiento de base de datos y autenticaci&oacute;n.</li>
                <li><strong>Vercel:</strong> alojamiento de la aplicaci&oacute;n web.</li>
                <li><strong>ElevenLabs:</strong> generaci&oacute;n de voz para pacientes que tienen modo voz habilitado. Se env&iacute;a &uacute;nicamente texto.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">8. Transferencia internacional de datos</h2>
              <p>
                Los proveedores mencionados tienen servidores ubicados en Estados Unidos. Estas transferencias se realizan bajo cl&aacute;usulas contractuales que garantizan un nivel adecuado de protecci&oacute;n, conforme a lo dispuesto en la Ley 21.719. Al aceptar esta pol&iacute;tica, consientes expresamente la transferencia internacional de tus datos a estos proveedores para las finalidades indicadas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">9. Conservaci&oacute;n de datos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Datos de cuenta y perfil:</strong> mientras tu cuenta est&eacute; activa o hasta que solicites su eliminaci&oacute;n.</li>
                <li><strong>Contenido de sesiones:</strong> durante el per&iacute;odo acad&eacute;mico vigente y hasta 2 a&ntilde;os posteriores, para fines de seguimiento e investigaci&oacute;n pedag&oacute;gica.</li>
                <li><strong>Datos de uso:</strong> 1 a&ntilde;o desde su recopilaci&oacute;n.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">10. Tus derechos (ARCOP)</h2>
              <p>
                Conforme a la legislaci&oacute;n chilena de protecci&oacute;n de datos, tienes derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Acceso:</strong> conocer qu&eacute; datos personales tuyos tratamos.</li>
                <li><strong>Rectificaci&oacute;n:</strong> solicitar la correcci&oacute;n de datos inexactos.</li>
                <li><strong>Cancelaci&oacute;n:</strong> solicitar la eliminaci&oacute;n de tus datos.</li>
                <li><strong>Oposici&oacute;n:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso com&uacute;n.</li>
              </ul>
              <p>
                Para ejercer estos derechos, escribe a <strong>gloria@ugm.cl</strong>. Responderemos en un plazo m&aacute;ximo de 30 d&iacute;as h&aacute;biles.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">11. Seguridad</h2>
              <p>
                Implementamos medidas t&eacute;cnicas y organizativas para proteger tus datos, incluyendo: cifrado en tr&aacute;nsito (TLS), pol&iacute;ticas de seguridad a nivel de fila (RLS) en la base de datos, control de acceso basado en roles, y revisiones peri&oacute;dicas de seguridad.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">12. Modificaciones</h2>
              <p>
                Podemos actualizar esta pol&iacute;tica peri&oacute;dicamente. Notificaremos cambios sustanciales a trav&eacute;s de la plataforma o por correo electr&oacute;nico. El uso continuado de GlorIA despu&eacute;s de la notificaci&oacute;n constituye aceptaci&oacute;n de la pol&iacute;tica actualizada.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">13. Legislaci&oacute;n aplicable</h2>
              <p>
                Esta pol&iacute;tica se rige por la legislaci&oacute;n chilena, en particular la Ley 19.628 sobre Protecci&oacute;n de la Vida Privada, la Ley 21.719 que la modifica, y la Constituci&oacute;n Pol&iacute;tica de la Rep&uacute;blica, art&iacute;culo 19 N&deg; 4. Para cualquier controversia, ser&aacute;n competentes los tribunales ordinarios de justicia de Santiago, Chile.
              </p>
            </section>

          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link href="/" className="text-sm text-sidebar hover:underline">Volver al inicio</Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
