import { notFound } from "next/navigation";
import Link from "next/link";
import { LEARNING_DATA } from "@/lib/learning-data";
import { createClient } from "@/lib/supabase/server";
import ExampleAccordion from "./ExampleAccordion";

export default async function CompetencyPage({
  params,
}: {
  params: Promise<{ competency: string }>;
}) {
  const { competency } = await params;

  const data = LEARNING_DATA.find((c) => c.key === competency);
  if (!data) notFound();

  // Fetch student's reading progress
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let readExampleIds: string[] = [];
  if (user) {
    const { data: progress } = await supabase
      .from("learning_progress")
      .select("example_id")
      .eq("student_id", user.id)
      .eq("competency", competency);
    readExampleIds = progress?.map((p) => p.example_id) || [];
  }

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <Link
          href="/aprendizaje"
          className="text-xs text-sidebar hover:underline mb-3 inline-block"
        >
          &larr; Volver a Aprendizaje
        </Link>
        <div className="flex items-start gap-5 max-w-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/learning/${data.key}.png`}
            alt={data.name}
            className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-sm"
          />
          <div>
            <p className="text-[10px] font-semibold text-sidebar/60 uppercase tracking-wider mb-1">{data.domain}</p>
            <h1 className="text-2xl font-bold text-gray-900">
              {data.emoji} {data.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1 italic">
              {data.description}
            </p>
          </div>
        </div>
      </header>

      <div className="px-8 pb-8">
        <ExampleAccordion
          examples={data.examples}
          competencyKey={competency}
          readExampleIds={readExampleIds}
        />
      </div>
    </div>
  );
}
