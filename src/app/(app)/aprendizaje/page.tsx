import Link from "next/link";
import { LEARNING_DATA } from "@/lib/learning-data";
import { createClient } from "@/lib/supabase/server";
import { GraduationCap, Lock } from "lucide-react";
import AskGloriaBubble from "./AskGloriaBubble";

export default async function AprendizajePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let progressMap: Record<string, number> = {};
  let tutorCompleted = false;

  if (user) {
    const { data: progress } = await supabase
      .from("learning_progress")
      .select("competency")
      .eq("student_id", user.id);

    progress?.forEach((p) => {
      progressMap[p.competency] = (progressMap[p.competency] || 0) + 1;
      if (p.competency === "tutor") tutorCompleted = true;
    });
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Aprendizaje</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Completa una sesión con el tutor para desbloquear los módulos de competencias
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* Tutor card — FIRST position */}
          <Link
            href="/aprendizaje/tutor"
            className="bg-white rounded-xl border-2 border-dashed border-emerald-300 overflow-hidden hover:border-emerald-500 hover:shadow-md transition-all group"
          >
            <div className="aspect-[4/3] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/learning/tutor.png" alt="Tutor" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute top-2 left-2">
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                  {tutorCompleted ? "Completado" : "Paso 1 — Obligatorio"}
                </span>
              </div>
              {tutorCompleted && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Completado
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎓</span>
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  Practicar con tutor
                </h3>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                Conversa con un paciente ficticio mientras un tutor clínico te guía en tiempo real.
              </p>
              <span className="text-xs font-medium text-emerald-600 group-hover:underline">
                {tutorCompleted ? "Practicar de nuevo" : "Iniciar sesión guiada"}
              </span>
            </div>
          </Link>

          {/* Competency cards */}
          {LEARNING_DATA.map((comp) => {
            const read = progressMap[comp.key] || 0;
            const total = comp.examples.length;
            const pct = Math.round((read / total) * 100);
            const isComplete = read >= total;
            const isLocked = !tutorCompleted;

            return (
              <div key={comp.key} className="relative">
                {isLocked ? (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-50">
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/learning/${comp.key}.png`} alt={comp.name}
                        className="w-full h-full object-cover grayscale" />
                      <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                        <div className="bg-white rounded-full p-3 shadow">
                          <Lock size={24} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-semibold text-gray-400 mb-1">{comp.emoji} {comp.name}</h3>
                      <p className="text-[10px] text-gray-300 mb-2">{comp.domain}</p>
                      <p className="text-xs text-gray-300">Completa una sesión con el tutor para desbloquear</p>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/aprendizaje/${comp.key}`}
                    className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-sidebar/30 hover:shadow-md transition-all group"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/learning/${comp.key}.png`} alt={comp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {isComplete && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Completado
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{comp.emoji}</span>
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-sidebar transition-colors">
                          {comp.name}
                        </h3>
                      </div>
                      <p className="text-[10px] text-sidebar/60 font-medium mb-1">{comp.domain}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{comp.description}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">{read}/{total} ejemplos</span>
                          <span className="text-xs font-medium text-sidebar">{pct}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className="bg-sidebar h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <AskGloriaBubble />
    </div>
  );
}
