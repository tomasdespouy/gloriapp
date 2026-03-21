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

  const [{ data: session }, { data: segments }] = await Promise.all([
    supabase
      .from("observation_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("student_id", user.id)
      .single(),
    supabase
      .from("observation_segments")
      .select("*")
      .eq("session_id", sessionId)
      .order("segment_order", { ascending: true }),
  ]);

  if (!session) redirect("/historial");

  return (
    <div className="min-h-screen">
      <ObservacionReviewClient session={session} segments={segments || []} />
    </div>
  );
}
