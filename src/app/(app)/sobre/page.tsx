export default function SobrePage() {
  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/gloria-logo.png" alt="GlorIA" className="h-10 w-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Sobre GlorIA</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Conoce la plataforma, su propósito y como protegemos tus datos
        </p>
      </header>

      <div className="px-8 pb-12 max-w-4xl space-y-10">
        {/* Video */}
        <section>
          <div className="rounded-xl overflow-hidden shadow-md aspect-video">
            <iframe
              src="https://www.youtube.com/embed/N-TJDF7_A1k"
              title="Presentacion GlorIA"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </section>

        {/* Qué es GlorIA */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Qué es GlorIA
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            GlorIA es una plataforma de entrenamiento clínico basada en Inteligencia Artificial, diseñada para que estudiantes de psicologia practiquen conversaciones terapéuticas en un entorno seguro y controlado.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Cada paciente virtual tiene una personalidad, historia de vida y cuadro clínico único, construido con rigor académico por profesionales de la salud mental. Los estudiantes pueden practicar técnicas terapéuticas, recibir retroalimentación estructurada y desarrollar competencias clínicas antes de trabajar con pacientes reales.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            El nombre rinde homenaje al histórico caso &quot;Gloria&quot; de 1965, filmado por el Dr. Everett Shostrom, donde tres pioneros de la psicoterapia — Carl Rogers (Terapia Humanista), Fritz Perls (Terapia Gestalt) y Albert Ellis (Terapia Racional Emotiva) — demostraron sus enfoques con la misma paciente, marcando un antes y después en la enseñanza de la psicoterapia.
          </p>
        </section>

        {/* Propósito pedagógico */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            📚 Propósito pedagógico
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            GlorIA existe exclusivamente con fines educativos y de formación académica. La plataforma esta diseñada para:
          </p>
          <ul className="space-y-2 ml-1">
            {[
              "Permitir la práctica repetida y sin riesgo de habilidades terapéuticas fundamentales",
              "Ofrecer retroalimentación inmediata y estructurada basada en 7 competencias clínicas",
              "Exponer a los estudiantes a diversidad de cuadros clínicos y niveles de complejidad",
              "Fomentar la autorreflexión a traves de ejercicios post-sesión guiados",
              "Complementar (nunca reemplazar) la supervisión clínica humana y la formación presencial",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-sidebar flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Ética y construcción de pacientes */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            🧠 Ética en la construcción de pacientes
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Los pacientes virtuales de GlorIA fueron diseñados siguiendo principios éticos rigurosos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "Ficción clínica fundamentada",
                desc: "Cada paciente es completamente ficticio. No representa ni esta basado en ningún paciente real. Los perfiles se construyen a partir de literatura clínica y supervisión académica.",
              },
              {
                title: "Diversidad representativa",
                desc: "Los pacientes reflejan diversidad de género, edad, nivel socioeconómico y contexto cultural, buscando representar la realidad clínica chilena y latinoamericana.",
              },
              {
                title: "Supervisión profesional",
                desc: "Los prompts y comportamientos de cada paciente fueron revisados por profesionales de la salud mental para asegurar coherencia clínica y realismo terapéutico.",
              },
              {
                title: "Sin estereotipos dañinos",
                desc: "Se evitan representaciones estigmatizantes de condiciones de salud mental. Los pacientes son personas complejas, no reducidas a su diagnóstico.",
              },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-1">{card.title}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacidad y datos */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            🔒 Privacidad y uso de datos
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            La protección de los datos de nuestros usuarios es una prioridad fundamental:
          </p>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
            {[
              {
                title: "Uso exclusivamente pedagógico",
                desc: "Tus conversaciones y datos se utilizan únicamente para tu formación académica. No se venden, comparten ni utilizan con fines comerciales.",
              },
              {
                title: "Conversaciónes privadas",
                desc: "Tus sesiones de práctica son privadas. Solo tu puedes verlas. Los profesores pueden acceder a métricas agregadas de progreso, pero no al contenido textual de las sesiones sin tu consentímiento.",
              },
              {
                title: "Datos almacenados de forma segura",
                desc: "Utilizamos Supabase con cifrado en tránsito y en reposo. Las políticas de seguridad a nivel de fila (RLS) garantizan que solo puedes acceder a tus propios datos.",
              },
              {
                title: "Sin entrenamiento de modelos",
                desc: "Tus conversaciones no se utilizan para entrenar modelos de inteligencia artificial. Los proveedores de IA (OpenAI/Google) no retienen tus datos según sus políticas de API empresarial.",
              },
              {
                title: "Derecho a eliminación",
                desc: "Puedes solicitar la eliminación completa de tu cuenta y todos tus datos en cualquier momento contactando al equipo académico.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Limitaciones */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            ⚠️ Limitaciones importantes
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <ul className="space-y-2">
              {[
                "GlorIA es una herramienta de práctica, no un sustituto de la supervisión clínica real.",
                "Los pacientes virtuales, por más realistas que sean, no reemplazan la complejidad de un paciente humano.",
                "Las evaluaciones de competencias son orientativas. La evaluación definitiva corresponde al docente y supervisor clínico.",
                "La plataforma no es apta para uso clínico real ni para atención de pacientes.",
                "Si un estudiante experimenta malestar emociónal durante la práctica, debe contactar a su supervisor o al servicio de apoyo de la universidad.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Créditos */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            🎓 Créditos
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/universities/ugm.png" alt="Universidad Gabriela Mistral" className="h-12 w-auto" />
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              GlorIA es un proyecto desarrollado en la Universidad Gabriela Mistral, Santiago de Chile.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              La plataforma fue creada con el objetivo de democratizar el acceso a prácticas clínicas de calidad, aprovechando las capacidades de la inteligencia artificial generativa de forma ética y responsable.
            </p>
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-xs text-gray-400">
                Glor-IA.com es marca registrada. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
