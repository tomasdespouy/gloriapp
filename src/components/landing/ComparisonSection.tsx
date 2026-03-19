"use client";

import { Check, X, Minus } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

function Icon({ type }: { type: string }) {
  if (type === "check") return <Check size={16} className="text-green-500" />;
  if (type === "x") return <X size={16} className="text-red-400" />;
  return <Minus size={16} className="text-amber-400" />;
}

export default function ComparisonSection() {
  const ROWS = [
    { feature: "Disponibilidad", traditional: "Requiere coordinar horarios entre compa\u00f1eros", gloria: "24/7, practica cuando quieras", tradIcon: "minus", gloriaIcon: "check" },
    { feature: "Realismo del paciente", traditional: "Depende de la habilidad actoral del compa\u00f1ero", gloria: "IA entrenada con perfiles cl\u00ednicos validados", tradIcon: "minus", gloriaIcon: "check" },
    { feature: "Variedad de casos", traditional: "Limitado a lo que el compa\u00f1ero pueda improvisar", gloria: "34+ pacientes con cuadros cl\u00ednicos diversos", tradIcon: "x", gloriaIcon: "check" },
    { feature: "Retroalimentaci\u00f3n inmediata", traditional: "Depende del supervisor presente", gloria: "Evaluaci\u00f3n autom\u00e1tica de 10 competencias al terminar", tradIcon: "x", gloriaIcon: "check" },
    { feature: "Repetibilidad", traditional: "Dif\u00edcil recrear el mismo escenario dos veces", gloria: "Mismo paciente, misma historia, m\u00faltiples intentos", tradIcon: "x", gloriaIcon: "check" },
    { feature: "Riesgo para el paciente", traditional: "El compa\u00f1ero puede sentirse inc\u00f3modo", gloria: "Cero riesgo \u2014 el paciente es IA", tradIcon: "minus", gloriaIcon: "check" },
    { feature: "Seguimiento de progreso", traditional: "Manual, depende del docente", gloria: "Dashboard con m\u00e9tricas, XP, historial completo", tradIcon: "x", gloriaIcon: "check" },
    { feature: "Costo por sesi\u00f3n", traditional: "Tiempo de supervisores y compa\u00f1eros", gloria: "Costo marginal cercano a cero por sesi\u00f3n", tradIcon: "minus", gloriaIcon: "check" },
    { feature: "Interacci\u00f3n humana real", traditional: "Contacto directo con otra persona", gloria: "Simulaci\u00f3n \u2014 complementa, no reemplaza", tradIcon: "check", gloriaIcon: "minus" },
    { feature: "Supervisi\u00f3n docente", traditional: "Presencial durante la pr\u00e1ctica", gloria: "Acceso a transcripciones y evaluaciones post-sesi\u00f3n", tradIcon: "check", gloriaIcon: "check" },
  ];

  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              {"GlorIA vs. m\u00e9todo tradicional"}
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              {"C\u00f3mo se compara la pr\u00e1ctica con pacientes IA frente al role-play tradicional entre compa\u00f1eros."}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 w-[35%]"></th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400 w-[32.5%]">Role-play tradicional</th>
                  <th className="text-left py-3 px-4 font-bold text-sidebar w-[32.5%]">GlorIA</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 text-xs">{row.feature}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0"><Icon type={row.tradIcon} /></span>
                        <span>{row.traditional}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex-shrink-0"><Icon type={row.gloriaIcon} /></span>
                        <span>{row.gloria}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-6">
            {"GlorIA complementa la formaci\u00f3n cl\u00ednica tradicional. La supervisi\u00f3n humana y la pr\u00e1ctica presencial siguen siendo fundamentales."}
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
