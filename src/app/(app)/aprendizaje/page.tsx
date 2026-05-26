import Link from "next/link";
import { LEARNING_DATA } from "@/lib/learning-data";
import { createClient } from "@/lib/supabase/server";

export default async function AprendizajePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const progressMap: Record<string, number> = {};

  if (user) {
    const { data: progress } = await supabase
      .from("learning_progress")
      .select("competency")
      .eq("student_id", user.id);

    // Legacy "tutor" rows are ignored — the guided tutor onboarding was retired.
    progress?.forEach((p) => {
      if (p.competency !== "tutor") {
        progressMap[p.competency] = (progressMap[p.competency] || 0) + 1;
      }
    });
  }

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Aprendizaje</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Explora ejemplos y buenas prácticas por competencia
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* Competency cards */}
          {LEARNING_DATA.map((comp) => {
            const read = progressMap[comp.key] || 0;
            const total = comp.examples.length;
            const pct = Math.round((read / total) * 100);
            const isComplete = read >= total;

            return (
              <Link
                key={comp.key}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
