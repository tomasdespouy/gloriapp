import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/admin-helpers";
import RetroClient from "./RetroClient";

export default async function RetroalimentacionPage() {
  const ctx = await getAdminContext();
  const admin = createAdminClient();

  // Fetch all data in parallel
  const [
    { data: surveys },
    { data: responses },
    { data: establishments },
    { data: courses },
    { data: sections },
  ] = await Promise.all([
    admin.from("surveys").select("*").order("created_at", { ascending: false }),
    admin.from("survey_responses").select("*, profiles!survey_responses_user_id_fkey(full_name, establishment_id, course_id, section_id)").order("created_at", { ascending: false }),
    admin.from("establishments").select("id, name, country").order("name"),
    admin.from("courses").select("id, name, establishment_id").order("name"),
    admin.from("sections").select("id, name, course_id").order("name"),
  ]);

  // Build NPS summary
  const allScores = (responses || []).map(r => r.nps_score as number);
  const promoters = allScores.filter(s => s >= 9).length;
  const detractors = allScores.filter(s => s <= 6).length;
  const nps = allScores.length > 0 ? Math.round(((promoters - detractors) / allScores.length) * 100) : 0;

  return (
    <RetroClient
      surveys={surveys || []}
      responses={(responses || []).map(r => ({
        ...r,
        userName: (r.profiles as unknown as { full_name: string })?.full_name || "—",
        establishmentId: (r.profiles as unknown as { establishment_id: string })?.establishment_id,
        courseId: (r.profiles as unknown as { course_id: string })?.course_id,
        sectionId: (r.profiles as unknown as { section_id: string })?.section_id,
      }))}
      establishments={establishments || []}
      courses={courses || []}
      sections={sections || []}
      nps={nps}
      totalResponses={allScores.length}
      isSuperadmin={ctx.isSuperadmin}
    />
  );
}
