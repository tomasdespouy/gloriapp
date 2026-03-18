import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Términos y Condiciones — GlorIA",
  description: "Términos y condiciones de uso de la plataforma GlorIA.",
};

export default async function TerminosPage() {
  const dict = await getDictionary("es");

  return (
    <>
      <LandingNavbar dict={dict} locale="es" />
      <main className="bg-[#FAFAFA] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Términos y Condiciones de Uso</h1>
          <p className="text-sm text-gray-400 mb-10">Última actualización: 18 de marzo de 2026</p>

          <div className="prose prose-sm prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-900">1. Aceptación de los términos</h2>
              <p>
                Al crear una cuenta y utilizar la plataforma GlorIA, aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo con alguna de sus disposiciones, no debes utilizar la plataforma. GlorIA se reserva el derecho de modificar estos términos, notificando a los usuarios con antelación razonable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">2. Descripción del servicio</h2>
              <p>
                GlorIA es una plataforma educativa que permite a estudiantes de psicología practicar competencias clínicas mediante conversaciones con pacientes simulados por inteligencia artificial. El servicio incluye:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Sesiones de práctica con pacientes IA con distintas personalidades y cuadros clínicos.</li>
                <li>Evaluaciones automatizadas de competencias clínicas generadas por IA.</li>
                <li>Módulos de aprendizaje y tutoría pedagógica.</li>
                <li>Seguimiento de progreso y retroalimentación.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">3. Naturaleza educativa — Exclusión de relación terapéutica</h2>
              <p>
                GlorIA es una herramienta de formación académica. Los pacientes son personajes ficticios generados por inteligencia artificial. <strong>No se establece relación terapéutica alguna</strong> entre el usuario y los pacientes simulados. Las interacciones no constituyen atención psicológica, psiquiátrica ni médica de ningún tipo.
              </p>
              <p>
                Las evaluaciones generadas por IA son orientativas y pedagógicas. No reemplazan la evaluación académica formal de tu institución educativa ni constituyen certificación profesional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">4. Requisitos de uso</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Debes ser mayor de 18 años. Al aceptar estos términos, confirmas que tienes la edad legal.</li>
                <li>Debes estar vinculado a una institución educativa que tenga un convenio activo con GlorIA.</li>
                <li>Debes utilizar un correo electrónico institucional válido para el registro.</li>
                <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">5. Uso aceptable</h2>
              <p>Te comprometes a:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Utilizar la plataforma exclusivamente con fines educativos y de formación clínica.</li>
                <li>No compartir, reproducir ni distribuir los escenarios clínicos, historias de pacientes ni contenido generado por la plataforma.</li>
                <li>No intentar hacer pasar las respuestas de los pacientes IA como conversaciones con personas reales.</li>
                <li>No utilizar la plataforma para obtener asesoría clínica real para terceros.</li>
                <li>No intentar vulnerar la seguridad de la plataforma ni acceder a datos de otros usuarios.</li>
                <li>Tratar las sesiones de práctica con la misma seriedad y ética que una interacción clínica real.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">6. Inteligencia artificial</h2>
              <p>
                Los pacientes de GlorIA son generados por modelos de inteligencia artificial (OpenAI GPT-4o, Google Gemini). Sus respuestas son simulaciones y pueden contener inexactitudes clínicas. La plataforma no garantiza que las respuestas de los pacientes IA sean clínicamente perfectas en todos los casos.
              </p>
              <p>
                Las imágenes de los pacientes son generadas por IA y no representan a personas reales. Las voces son sintetizadas mediante tecnología de texto a voz (ElevenLabs).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">7. Datos académicos e institucionales</h2>
              <p>
                Tu institución educativa podrá acceder a datos de tu progreso, evaluaciones y actividad en la plataforma con fines académicos. Esto incluye: número de sesiones, competencias evaluadas, puntajes y retroalimentación. El detalle de las conversaciones con pacientes simulados podrá ser revisado por docentes autorizados como parte del proceso formativo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">8. Propiedad intelectual</h2>
              <p>
                Todo el contenido de la plataforma — incluyendo diseño, código, textos, imágenes de pacientes, escenarios clínicos y material pedagógico — es propiedad de GlorIA y/o la Universidad Gabriela Mistral, protegido por la Ley 17.336 sobre Propiedad Intelectual.
              </p>
              <p>
                El contenido generado durante las sesiones de práctica (tus mensajes y las respuestas del paciente IA) podrá ser utilizado de forma anonimizada para investigación pedagógica y mejora de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">9. Limitación de responsabilidad</h2>
              <p>
                GlorIA se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos la disponibilidad ininterrumpida del servicio. En la máxima medida permitida por la ley:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>GlorIA no es responsable por decisiones clínicas o académicas tomadas basándose en las interacciones con la plataforma.</li>
                <li>GlorIA no es responsable por interrupciones del servicio, pérdida de datos de sesión o errores en las evaluaciones generadas por IA.</li>
                <li>La responsabilidad total de GlorIA frente al usuario no excederá el monto pagado por el usuario (si aplica) en los 12 meses anteriores al evento.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">10. Suspensión y terminación</h2>
              <p>
                GlorIA se reserva el derecho de suspender o cancelar tu cuenta en caso de incumplimiento de estos términos, uso indebido de la plataforma, o a solicitud de tu institución educativa. En caso de terminación, tus datos serán tratados conforme a nuestra <Link href="/privacidad" className="text-sidebar hover:underline">Política de Privacidad</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">11. Protección de datos personales</h2>
              <p>
                El tratamiento de datos personales se rige por nuestra <Link href="/privacidad" className="text-sidebar hover:underline">Política de Privacidad</Link>, que forma parte integral de estos términos. Al aceptar estos términos, aceptas también dicha política.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">12. Legislación aplicable y jurisdicción</h2>
              <p>
                Estos términos se rigen por las leyes de la República de Chile, en particular la Ley 19.496 sobre Protección de los Derechos de los Consumidores y su Reglamento de Comercio Electrónico. Para cualquier controversia derivada del uso de la plataforma, serán competentes los tribunales ordinarios de justicia de Santiago, Chile.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900">13. Contacto</h2>
              <p>
                Para consultas sobre estos términos, escribe a <strong>gloria@ugm.cl</strong>.
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
