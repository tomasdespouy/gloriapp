import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Cost per unit (USD) — estimates based on API pricing
const COSTS = {
  chat_message: 0.003,     // GPT-4o-mini ~500 tokens per patient response
  classification: 0.001,   // GPT-4o-mini intervention classification
  evaluation: 0.02,        // GPT-4o full competency evaluation
  voice_correction: 0.001, // GPT-4o-mini speech correction
  research_scan: 0.15,     // Tavily (10 queries) + GPT-4o analysis
  pdf_analysis: 0.02,      // GPT-4o PDF analysis
  image_gen: 0.08,         // DALL-E 3 HD
  video_gen: 0.30,         // Luma AI ray-2
  tts: 0.002,              // ElevenLabs per message
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0];
  const country = url.searchParams.get("country") || null;
  const establishmentId = url.searchParams.get("establishment") || null;

  const admin = createAdminClient();

  // Build student filter if country/establishment specified
  let studentIds: string[] | null = null;
  if (country || establishmentId) {
    let q = admin.from("profiles").select("id, establishment_id").eq("role", "student");
    if (establishmentId) {
      q = q.eq("establishment_id", establishmentId);
    }
    const { data: students } = await q;

    if (country && students) {
      const { data: estabs } = await admin.from("establishments").select("id").eq("country", country);
      const estabIds = new Set((estabs || []).map(e => e.id));
      studentIds = students.filter(s => estabIds.has(s.establishment_id)).map(s => s.id);
    } else {
      studentIds = (students || []).map(s => s.id);
    }
  }

  // Count chat messages (assistant = patient responses, user = student messages that trigger classification)
  let msgQuery = admin.from("messages").select("id", { count: "exact", head: true })
    .eq("role", "assistant").gte("created_at", from).lte("created_at", to + "T23:59:59");
  if (studentIds) {
    // Messages are linked through conversations
    const { data: convs } = await admin.from("conversations").select("id").in("student_id", studentIds);
    const convIds = (convs || []).map(c => c.id);
    if (convIds.length > 0) msgQuery = msgQuery.in("conversation_id", convIds);
    else msgQuery = msgQuery.eq("conversation_id", "00000000-0000-0000-0000-000000000000"); // no results
  }
  const { count: chatMessages } = await msgQuery;

  // Count user messages (each triggers classification)
  let userMsgQuery = admin.from("messages").select("id", { count: "exact", head: true })
    .eq("role", "user").gte("created_at", from).lte("created_at", to + "T23:59:59");
  if (studentIds) {
    const { data: convs } = await admin.from("conversations").select("id").in("student_id", studentIds);
    const convIds = (convs || []).map(c => c.id);
    if (convIds.length > 0) userMsgQuery = userMsgQuery.in("conversation_id", convIds);
    else userMsgQuery = userMsgQuery.eq("conversation_id", "00000000-0000-0000-0000-000000000000");
  }
  const { count: userMessages } = await userMsgQuery;

  // Count evaluations
  let evalQuery = admin.from("session_competencies").select("id", { count: "exact", head: true })
    .gte("created_at", from).lte("created_at", to + "T23:59:59");
  if (studentIds) evalQuery = evalQuery.in("student_id", studentIds);
  const { count: evaluations } = await evalQuery;

  // Count research scans (global, not per student)
  const { count: researchScans } = await admin.from("research_opportunities")
    .select("id", { count: "exact", head: true })
    .gte("scan_date", from).lte("scan_date", to);

  // Count papers analyzed
  const { count: papersAnalyzed } = await admin.from("research_papers")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from).lte("created_at", to + "T23:59:59");

  // Count active patients (images + videos generated)
  const { count: totalPatients } = await admin.from("ai_patients")
    .select("id", { count: "exact", head: true }).eq("is_active", true);

  // Calculate costs
  const chatCost = (chatMessages || 0) * COSTS.chat_message;
  const classifyCost = (userMessages || 0) * COSTS.classification;
  const evalCost = (evaluations || 0) * COSTS.evaluation;
  const researchCost = (researchScans || 0) > 0 ? Math.ceil((researchScans || 0) / 10) * COSTS.research_scan : 0;
  const papersCost = (papersAnalyzed || 0) * COSTS.pdf_analysis;
  const assetsCost = (totalPatients || 0) * (COSTS.image_gen + COSTS.video_gen);

  const totalCost = chatCost + classifyCost + evalCost + researchCost + papersCost;

  // Breakdown by establishment
  const { data: establishments } = await admin.from("establishments").select("id, name, country");
  const breakdown: { name: string; country: string; messages: number; cost: number }[] = [];

  if (establishments) {
    for (const est of establishments) {
      const { data: estStudents } = await admin.from("profiles").select("id").eq("role", "student").eq("establishment_id", est.id);
      if (!estStudents || estStudents.length === 0) continue;

      const sIds = estStudents.map(s => s.id);
      const { data: estConvs } = await admin.from("conversations").select("id").in("student_id", sIds);
      const cIds = (estConvs || []).map(c => c.id);

      if (cIds.length === 0) continue;

      const { count: estMsgs } = await admin.from("messages").select("id", { count: "exact", head: true })
        .eq("role", "assistant").in("conversation_id", cIds)
        .gte("created_at", from).lte("created_at", to + "T23:59:59");

      const msgs = estMsgs || 0;
      if (msgs > 0) {
        breakdown.push({
          name: est.name,
          country: est.country,
          messages: msgs,
          cost: msgs * COSTS.chat_message + msgs * COSTS.classification,
        });
      }
    }
    breakdown.sort((a, b) => b.cost - a.cost);
  }

  return NextResponse.json({
    period: { from, to },
    counts: {
      chatMessages: chatMessages || 0,
      userMessages: userMessages || 0,
      evaluations: evaluations || 0,
      researchScans: researchScans || 0,
      papersAnalyzed: papersAnalyzed || 0,
      totalPatients: totalPatients || 0,
    },
    costs: {
      chat: chatCost,
      classification: classifyCost,
      evaluation: evalCost,
      research: researchCost,
      papers: papersCost,
      assets: assetsCost,
      total: totalCost,
    },
    breakdown,
    unitCosts: COSTS,
  });
}
