import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ObservacionReviewClient from "./ObservacionReviewClient";

export default async function ObservacionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // El nuevo shape (llm_v1) guarda todo el resultado en
  // semantic_analysis JSONB de observation_sessions. Ya no usamos
  // observation_segments para grabaciones LLM.
  const { data: session } = await supabase
    .from("observation_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("student_id", user.id)
    .single();

  if (!session) redirect("/historial");

  return (
    <div className="min-h-screen">
      <ObservacionReviewClient session={session} />
    </div>
  );
}
