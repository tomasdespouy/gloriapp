import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Política de Privacidad — GlorIA",
  description: "Política de privacidad y protección de datos personales de la plataforma GlorIA.",
};

export default async function PrivacidadPage() {
  const dict = await getDictionary("es");

  return (
    <>
      <LandingNavbar dict={dict} locale="es" />
      <main className="bg-[#FAFAFA] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
          <p className="text-sm text-gray-400 mb-10">Última actualización: 18 de marzo de 2026</p>

          <div className="prose prose-sm prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Responsable del tratamiento</h2>
              <p>
                La plataforma GlorIA es operada por la Universidad Gabriela Mistral (en adelante, &quot;UGM&quot;), con domicilio en Av. Ricardo Lyon 1177, Providencia, Santiago, Chile. Para consultas sobre protección de datos, puedes escribir a <strong>gloria@ugm.cl</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">2. Datos que recopilamos</h2>
              <p>Recopilamos las siguientes categorías de datos personales:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Datos de registro:</strong> nombre completo, correo electrónico institucional, rol (estudiante/docente).</li>
                <li><strong>Datos académicos:</strong> institución, asignatura, sección, progreso en la plataforma (sesiones, evaluaciones, XP).</li>
                <li><strong>Contenido de sesiones:</strong> mensajes de texto intercambiados con los pacientes simulados por IA durante las sesiones de práctica clínica.</li>
                <li><strong>Transcripciones de voz:</strong> cuando utilizas el modo voz, el navegador convierte tu voz a texto localmente. GlorIA recibe y almacena únicamente la transcripción de texto resultante, no la grabación de audio.</li>
                <li><strong>Datos de uso:</strong> tiempo de sesión, frecuencia de uso, interacciones con la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">3. Finalidad del tratamiento</h2>
              <p>Utilizamos tus datos personales para las siguientes finalidades:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Proveer el servicio de práctica clínica con pacientes simulados por IA.</li>
                <li>Generar evaluaciones y retroalimentación sobre competencias clínicas.</li>
                <li>Facilitar el seguimiento académico por parte de tu institución educativa.</li>
                <li>Mejorar la calidad de la plataforma y la experiencia de aprendizaje.</li>
                <li>Comunicaciones relacionadas con el servicio (invitaciones, notificaciones).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">4. Base legal del tratamiento</h2>
              <p>
                El tratamiento de tus datos se fundamenta en las siguientes bases legales, conforme a la Ley 19.628 sobre Protección de la Vida Privada y la Ley 21.719 que la modifica:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Consentimiento:</strong> al crear tu cuenta y aceptar estos términos, consientes el tratamiento de tus datos para las finalidades indicadas.</li>
                <li><strong>Ejecución contractual:</strong> el tratamiento es necesario para prestarte el servicio educativo contratado.</li>
                <li><strong>Interés legítimo:</strong> para mejorar la plataforma y garantizar su seguridad.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">5. Modo voz y reconocimiento de habla</h2>
              <p>
                El modo voz utiliza la API de reconocimiento de voz del navegador (Web Speech API). El procesamiento de audio se realiza localmente en tu dispositivo o por el proveedor del navegador (por ejemplo, Google en Chrome). GlorIA no graba, almacena ni transmite audio. Solo recibimos la transcripción de texto resultante, que se envía directamente como mensaje al paciente simulado sin posibilidad de edición previa.
              </p>
              <p>
                Antes de activar el modo voz, se te solicitará consentimiento explícito. Puedes desactivarlo en cualquier momento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">6. Inteligencia artificial y decisiones automatizadas</h2>
              <p>
                GlorIA utiliza modelos de inteligencia artificial (OpenAI GPT-4o y Google Gemini) para simular pacientes y generar evaluaciones de competencias clínicas. Estas evaluaciones son orientativas y de carácter pedagógico; no constituyen diagnósticos clínicos ni evaluaciones académicas definitivas.
              </p>
              <p>
                Conforme a la Ley 21.719, tienes derecho a oponerte a decisiones basadas únicamente en tratamiento automatizado que te afecten significativamente, y a solicitar intervención humana en la revisión de evaluaciones generadas por IA.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">7. Compartición de datos con terceros</h2>
              <p>Compartimos datos personales con los siguientes terceros, exclusivamente para las finalidades descritas:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Tu institución educativa:</strong> datos de progreso y evaluaciones, para fines académicos.</li>
                <li><strong>OpenAI / Google:</strong> el contenido de los mensajes se envía a estos proveedores de IA para generar las respuestas de los pacientes simulados. Estos proveedores actúan como encargados de tratamiento.</li>
                <li><strong>Supabase (AWS):</strong> alojamiento de base de datos y autenticación.</li>
                <li><strong>Vercel:</strong> alojamiento de la aplicación web.</li>
                <li><strong>ElevenLabs:</strong> generación de voz para pacientes que tienen modo voz habilitado. Se envía únicamente texto.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">8. Transferencia internacional de datos</h2>
              <p>
                Los proveedores mencionados tienen servidores ubicados en Estados Unidos. Estas transferencias se realizan bajo cláusulas contractuales que garantizan un nivel adecuado de protección, conforme a lo dispuesto en la Ley 21.719. Al aceptar esta política, consientes expresamente la transferencia internacional de tus datos a estos proveedores para las finalidades indicadas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">9. Conservación de datos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Datos de cuenta y perfil:</strong> mientras tu cuenta esté activa o hasta que solicites su eliminación.</li>
                <li><strong>Contenido de sesiones:</strong> durante el período académico vigente y hasta 2 años posteriores, para fines de seguimiento e investigación pedagógica.</li>
                <li><strong>Datos de uso:</strong> 1 año desde su recopilación.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">10. Tus derechos (ARCOP)</h2>
              <p>
                Conforme a la legislación chilena de protección de datos, tienes derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Acceso:</strong> conocer qué datos personales tuyos tratamos.</li>
                <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos.</li>
                <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos.</li>
                <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
              </ul>
              <p>
                Para ejercer estos derechos, escribe a <strong>gloria@ugm.cl</strong>. Responderemos en un plazo máximo de 30 días hábiles.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">11. Seguridad</h2>
              <p>
                Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo: cifrado en tránsito (TLS), políticas de seguridad a nivel de fila (RLS) en la base de datos, control de acceso basado en roles, y revisiones periódicas de seguridad.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">12. Modificaciones</h2>
              <p>
                Podemos actualizar esta política periódicamente. Notificaremos cambios sustanciales a través de la plataforma o por correo electrónico. El uso continuado de GlorIA después de la notificación constituye aceptación de la política actualizada.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">13. Legislación aplicable</h2>
              <p>
                Esta política se rige por la legislación chilena, en particular la Ley 19.628 sobre Protección de la Vida Privada, la Ley 21.719 que la modifica, y la Constitución Política de la República, artículo 19 N° 4. Para cualquier controversia, serán competentes los tribunales ordinarios de justicia de Santiago, Chile.
              </p>
            </section>

          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <Link href="/" className="text-sm text-sidebar hover:underline">Volver al inicio</Link>
          </div>
        </div>
      </main>
      <LandingFooter dict={dict} locale="es" />
    </>
  );
}
