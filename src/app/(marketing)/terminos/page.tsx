import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "T\u00e9rminos y Condiciones \u2014 GlorIA",
  description: "T\u00e9rminos y condiciones de uso de la plataforma GlorIA.",
};

export default async function TerminosPage() {
  return (
    <>
      <LandingNavbar />
      <main className="bg-[#FAFAFA] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">T&eacute;rminos y Condiciones de Uso</h1>
          <p className="text-sm text-gray-400 mb-10">&Uacute;ltima actualizaci&oacute;n: 18 de marzo de 2026</p>

          <div className="prose prose-sm prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Aceptaci&oacute;n de los t&eacute;rminos</h2>
              <p>
                Al crear una cuenta y utilizar la plataforma GlorIA, aceptas estos t&eacute;rminos y condiciones en su totalidad. Si no est&aacute;s de acuerdo con alguna de sus disposiciones, no debes utilizar la plataforma. GlorIA se reserva el derecho de modificar estos t&eacute;rminos, notificando a los usuarios con antelaci&oacute;n razonable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">2. Descripci&oacute;n del servicio</h2>
              <p>
                GlorIA es una plataforma educativa que permite a estudiantes de psicolog&iacute;a practicar competencias cl&iacute;nicas mediante conversaciones con pacientes simulados por inteligencia artificial. El servicio incluye:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Sesiones de pr&aacute;ctica con pacientes IA con distintas personalidades y cuadros cl&iacute;nicos.</li>
                <li>Evaluaciones automatizadas de competencias cl&iacute;nicas generadas por IA.</li>
                <li>M&oacute;dulos de aprendizaje y tutor&iacute;a pedag&oacute;gica.</li>
                <li>Seguimiento de progreso y retroalimentaci&oacute;n.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">3. Naturaleza educativa &mdash; Exclusi&oacute;n de relaci&oacute;n terap&eacute;utica</h2>
              <p>
                GlorIA es una herramienta de formaci&oacute;n acad&eacute;mica. Los pacientes son personajes ficticios generados por inteligencia artificial. <strong>No se establece relaci&oacute;n terap&eacute;utica alguna</strong> entre el usuario y los pacientes simulados. Las interacciones no constituyen atenci&oacute;n psicol&oacute;gica, psiqui&aacute;trica ni m&eacute;dica de ning&uacute;n tipo.
              </p>
              <p>
                Las evaluaciones generadas por IA son orientativas y pedag&oacute;gicas. No reemplazan la evaluaci&oacute;n acad&eacute;mica formal de tu instituci&oacute;n educativa ni constituyen certificaci&oacute;n profesional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">4. Requisitos de uso</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Debes ser mayor de 18 a&ntilde;os. Al aceptar estos t&eacute;rminos, confirmas que tienes la edad legal.</li>
                <li>Debes estar vinculado a una instituci&oacute;n educativa que tenga un convenio activo con GlorIA.</li>
                <li>Debes utilizar un correo electr&oacute;nico institucional v&aacute;lido para el registro.</li>
                <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">5. Uso aceptable</h2>
              <p>Te comprometes a:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Utilizar la plataforma exclusivamente con fines educativos y de formaci&oacute;n cl&iacute;nica.</li>
                <li>No compartir, reproducir ni distribuir los escenarios cl&iacute;nicos, historias de pacientes ni contenido generado por la plataforma.</li>
                <li>No intentar hacer pasar las respuestas de los pacientes IA como conversaciones con personas reales.</li>
                <li>No utilizar la plataforma para obtener asesor&iacute;a cl&iacute;nica real para terceros.</li>
                <li>No intentar vulnerar la seguridad de la plataforma ni acceder a datos de otros usuarios.</li>
                <li>Tratar las sesiones de pr&aacute;ctica con la misma seriedad y &eacute;tica que una interacci&oacute;n cl&iacute;nica real.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">6. Inteligencia artificial</h2>
              <p>
                Los pacientes de GlorIA son generados por modelos de inteligencia artificial (OpenAI GPT-4o, Google Gemini). Sus respuestas son simulaciones y pueden contener inexactitudes cl&iacute;nicas. La plataforma no garantiza que las respuestas de los pacientes IA sean cl&iacute;nicamente perfectas en todos los casos.
              </p>
              <p>
                Las im&aacute;genes de los pacientes son generadas por IA y no representan a personas reales. Las voces son sintetizadas mediante tecnolog&iacute;a de texto a voz (ElevenLabs).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">7. Datos acad&eacute;micos e institucionales</h2>
              <p>
                Tu instituci&oacute;n educativa podr&aacute; acceder a datos de tu progreso, evaluaciones y actividad en la plataforma con fines acad&eacute;micos. Esto incluye: n&uacute;mero de sesiones, competencias evaluadas, puntajes y retroalimentaci&oacute;n. El detalle de las conversaciones con pacientes simulados podr&aacute; ser revisado por docentes autorizados como parte del proceso formativo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">8. Propiedad intelectual</h2>
              <p>
                Todo el contenido de la plataforma &mdash; incluyendo dise&ntilde;o, c&oacute;digo, textos, im&aacute;genes de pacientes, escenarios cl&iacute;nicos y material pedag&oacute;gico &mdash; es propiedad de GlorIA y/o la Universidad Gabriela Mistral, protegido por la Ley 17.336 sobre Propiedad Intelectual.
              </p>
              <p>
                El contenido generado durante las sesiones de pr&aacute;ctica (tus mensajes y las respuestas del paciente IA) podr&aacute; ser utilizado de forma anonimizada para investigaci&oacute;n pedag&oacute;gica y mejora de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">9. Limitaci&oacute;n de responsabilidad</h2>
              <p>
                GlorIA se proporciona &quot;tal cual&quot; y &quot;seg&uacute;n disponibilidad&quot;. No garantizamos la disponibilidad ininterrumpida del servicio. En la m&aacute;xima medida permitida por la ley:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>GlorIA no es responsable por decisiones cl&iacute;nicas o acad&eacute;micas tomadas bas&aacute;ndose en las interacciones con la plataforma.</li>
                <li>GlorIA no es responsable por interrupciones del servicio, p&eacute;rdida de datos de sesi&oacute;n o errores en las evaluaciones generadas por IA.</li>
                <li>La responsabilidad total de GlorIA frente al usuario no exceder&aacute; el monto pagado por el usuario (si aplica) en los 12 meses anteriores al evento.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">10. Suspensi&oacute;n y terminaci&oacute;n</h2>
              <p>
                GlorIA se reserva el derecho de suspender o cancelar tu cuenta en caso de incumplimiento de estos t&eacute;rminos, uso indebido de la plataforma, o a solicitud de tu instituci&oacute;n educativa. En caso de terminaci&oacute;n, tus datos ser&aacute;n tratados conforme a nuestra <Link href="/privacidad" className="text-sidebar hover:underline">Pol&iacute;tica de Privacidad</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">11. Protecci&oacute;n de datos personales</h2>
              <p>
                El tratamiento de datos personales se rige por nuestra <Link href="/privacidad" className="text-sidebar hover:underline">Pol&iacute;tica de Privacidad</Link>, que forma parte integral de estos t&eacute;rminos. Al aceptar estos t&eacute;rminos, aceptas tambi&eacute;n dicha pol&iacute;tica.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">12. Legislaci&oacute;n aplicable y jurisdicci&oacute;n</h2>
              <p>
                Estos t&eacute;rminos se rigen por las leyes de la Rep&uacute;blica de Chile, en particular la Ley 19.496 sobre Protecci&oacute;n de los Derechos de los Consumidores y su Reglamento de Comercio Electr&oacute;nico. Para cualquier controversia derivada del uso de la plataforma, ser&aacute;n competentes los tribunales ordinarios de justicia de Santiago, Chile.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">13. Contacto</h2>
              <p>
                Para consultas sobre estos t&eacute;rminos, escribe a <strong>gloria@ugm.cl</strong>.
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
