import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SAFE_EMPTY = ["00000000-0000-0000-0000-000000000000"];
const pct = (curr: number, prev: number) =>
  prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin" && profile?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const isSuperadmin = profile.role === "superadmin";
    const admin = createAdminClient();

    // Admin establishment scope
    let adminEstIds: string[] = [];
    if (isSuperadmin) {
      const { data } = await admin.from("establishments").select("id");
      adminEstIds = (data || []).map((e) => e.id);
    } else {
      const { data } = await supabase
        .from("admin_establishments")
        .select("establishment_id")
        .eq("admin_id", user.id);
      adminEstIds = (data || []).map((a) => a.establishment_id);
    }

    // ── Parse filters ──
    const sp = req.nextUrl.searchParams;
    const fCountry = sp.get("country") || "";
    const fEstId = sp.get("establishment") || "";
    const fCourseId = sp.get("course") || "";
    const fSectionId = sp.get("section") || "";
    const now = new Date();
    const from =
      sp.get("from") ||
      new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const to = sp.get("to") || now.toISOString().split("T")[0];

    // ── Filter options ──
    const [{ data: rawEsts }, { data: rawCourses }, { data: rawSections }] =
      await Promise.all([
        admin
          .from("establishments")
          .select("id, name, country")
          .eq("is_active", true)
          .order("name"),
        admin
          .from("courses")
          .select("id, name, establishment_id")
          .eq("is_active", true)
          .order("name"),
        admin
          .from("sections")
          .select("id, name, course_id")
          .eq("is_active", true)
          .order("name"),
      ]);

    const allEsts = (rawEsts || []).filter(
      (e) => isSuperadmin || adminEstIds.includes(e.id)
    );
    const countries = [
      ...new Set(allEsts.map((e) => e.country).filter(Boolean)),
    ].sort() as string[];

    // ── Compute establishment scope ──
    let scopeEstIds: string[] | null = isSuperadmin ? null : adminEstIds;
    if (fCountry) {
      const ids = allEsts.filter((e) => e.country === fCountry).map((e) => e.id);
      scopeEstIds = scopeEstIds
        ? scopeEstIds.filter((id) => ids.includes(id))
        : ids;
    }
    if (fEstId) {
      scopeEstIds =
        scopeEstIds === null || scopeEstIds.includes(fEstId) ? [fEstId] : [];
    }

    // ── Students ──
    let studentsQ = admin
      .from("profiles")
      .select("id, establishment_id, course_id, section_id, created_at")
      .eq("role", "student");
    if (scopeEstIds !== null) {
      studentsQ = studentsQ.in(
        "establishment_id",
        scopeEstIds.length > 0 ? scopeEstIds : SAFE_EMPTY
      );
    }
    if (fCourseId) studentsQ = studentsQ.eq("course_id", fCourseId);
    if (fSectionId) studentsQ = studentsQ.eq("section_id", fSectionId);

    const { data: studentsData } = await studentsQ;
    const students = studentsData || [];
    const studentIds = students.map((s) => s.id);
    const safeIds = studentIds.length > 0 ? studentIds : SAFE_EMPTY;

    // ── Date boundaries ──
    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T23:59:59Z");
    const periodMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - periodMs - 86400000)
      .toISOString()
      .split("T")[0];

    // ── Batch fetch ──
    const [
      { data: convsCurrent },
      { data: convsPrev },
      { data: allComps },
      { data: feedbacks },
      { data: pilots },
      { data: lifetimeConvsData },
      { data: platformActivityData },
      { data: platformActivityPrevData },
    ] = await Promise.all([
      admin
        .from("conversations")
        .select(
          "id, student_id, session_number, status, started_at, active_seconds"
        )
        .in("student_id", safeIds)
        .gte("started_at", from)
        .lte("started_at", to + "T23:59:59")
        .limit(5000),
      admin
        .from("conversations")
        .select("id, student_id, status, active_seconds")
        .in("student_id", safeIds)
        .gte("started_at", prevFrom)
        .lt("started_at", from)
        .limit(5000),
      admin
        .from("session_competencies")
        .select(
          "conversation_id, student_id, setting_terapeutico, motivo_consulta, datos_contextuales, objetivos, escucha_activa, actitud_no_valorativa, optimismo, presencia, conducta_no_verbal, contencion_afectos, overall_score_v2, eval_version, feedback_status"
        )
        .in("student_id", safeIds)
        .eq("eval_version", 2)
        .limit(5000),
      admin
        .from("session_feedback")
        .select("conversation_id, student_id")
        .in("student_id", safeIds)
        .limit(5000),
      admin.from("pilots").select("id, status, country").limit(100),
      admin
        .from("conversations")
        .select("id, student_id, status")
        .in("student_id", safeIds)
        .limit(10000),
      // Platform activity (time on platform)
      admin
        .from("platform_activity")
        .select("user_id, activity_date, active_seconds")
        .in("user_id", safeIds)
        .gte("activity_date", from)
        .lte("activity_date", to)
        .limit(10000),
      // Previous period platform activity
      admin
        .from("platform_activity")
        .select("user_id, active_seconds")
        .in("user_id", safeIds)
        .gte("activity_date", prevFrom)
        .lt("activity_date", from)
        .limit(10000),
    ]);

    const conversations = convsCurrent || [];
    const prevConversations = convsPrev || [];
    const competencies = allComps || [];
    const selfEvals = feedbacks || [];
    const allPilots = pilots || [];
    const lifetimeConvs = lifetimeConvsData || [];
    const platformActivity = platformActivityData || [];
    const platformActivityPrev = platformActivityPrevData || [];

    // ── Live metrics ──
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    const todayDate = now.toISOString().split("T")[0];

    let onlineQ = admin
      .from("profiles")
      .select("id")
      .gte("last_seen_at", twoMinAgo);
    if (scopeEstIds !== null) {
      onlineQ = onlineQ.in(
        "establishment_id",
        scopeEstIds.length > 0 ? scopeEstIds : SAFE_EMPTY
      );
    }

    const [{ data: onlineUsers }, { data: todayActivityData }] =
      await Promise.all([
        onlineQ,
        admin
          .from("platform_activity")
          .select("active_seconds")
          .eq("activity_date", todayDate),
      ]);

    const onlineNow = onlineUsers?.length || 0;
    const onlineIds = (onlineUsers || []).map(
      (u: { id: string }) => u.id
    );

    // In-session: online users with active conversations
    let inSession = 0;
    if (onlineIds.length > 0) {
      const { data: activeConvs } = await admin
        .from("conversations")
        .select("student_id")
        .eq("status", "active")
        .in("student_id", onlineIds);
      inSession = new Set(
        (activeConvs || []).map((c: { student_id: string }) => c.student_id)
      ).size;
    }

    const platformMinutesToday = Math.round(
      (todayActivityData || []).reduce(
        (s: number, a: { active_seconds: number }) =>
          s + (a.active_seconds || 0),
        0
      ) / 60
    );

    // ── KPIs ──
    const totalStudents = studentIds.length;
    const activeStudentSet = new Set(conversations.map((c) => c.student_id));
    const activeStudents = activeStudentSet.size;

    const completedConvs = conversations.filter(
      (c) => c.status === "completed" && (c.active_seconds || 0) > 0
    );
    const avgTimeMinutes =
      completedConvs.length > 0
        ? completedConvs.reduce((s, c) => s + (c.active_seconds || 0), 0) /
          completedConvs.length /
          60
        : 0;

    // First session satisfaction
    const firstSessionConvIds = new Set(
      conversations
        .filter((c) => c.session_number === 1 && c.status === "completed")
        .map((c) => c.id)
    );
    const firstSessionComps = competencies.filter(
      (c) =>
        firstSessionConvIds.has(c.conversation_id) &&
        Number(c.overall_score_v2) > 0
    );
    const firstSessionScore =
      firstSessionComps.length > 0
        ? firstSessionComps.reduce(
            (s, c) => s + Number(c.overall_score_v2),
            0
          ) / firstSessionComps.length
        : 0;

    // Evaluations
    const convIds = new Set(conversations.map((c) => c.id));
    const selfEvalsInPeriod = selfEvals.filter((f) =>
      convIds.has(f.conversation_id)
    );
    const selfEvalStudents = new Set(
      selfEvalsInPeriod.map((f) => f.student_id)
    );
    const approvedComps = competencies.filter(
      (c) => convIds.has(c.conversation_id) && c.feedback_status === "approved"
    );
    const teacherEvalStudents = new Set(
      approvedComps.map((c) => c.student_id)
    );

    // Return rate
    const completedPerStudent = new Map<string, number>();
    for (const c of conversations) {
      if (c.status === "completed") {
        completedPerStudent.set(
          c.student_id,
          (completedPerStudent.get(c.student_id) || 0) + 1
        );
      }
    }
    const withOne = [...completedPerStudent.values()].filter(
      (v) => v >= 1
    ).length;
    const withTwo = [...completedPerStudent.values()].filter(
      (v) => v >= 2
    ).length;
    const returnRate = withOne > 0 ? Math.round((withTwo / withOne) * 100) : 0;

    // Pilots
    const activePilots = allPilots.filter((p) =>
      ["en_curso", "validado", "enviado"].includes(p.status)
    ).length;
    const completedPilots = allPilots.filter(
      (p) => p.status === "finalizado"
    ).length;

    // ── Trends ──
    const prevActive = new Set(prevConversations.map((c) => c.student_id)).size;
    const prevCompleted = prevConversations.filter(
      (c) => c.status === "completed" && (c.active_seconds || 0) > 0
    );
    const prevAvg =
      prevCompleted.length > 0
        ? prevCompleted.reduce((s, c) => s + (c.active_seconds || 0), 0) /
          prevCompleted.length /
          60
        : 0;
    const prevStudentCount = students.filter(
      (s) => new Date(s.created_at) < fromDate
    ).length;

    // ── Platform time ──
    // Average daily minutes per active user in the period
    const platUserTotals = new Map<string, number>();
    for (const a of platformActivity as { user_id: string; active_seconds: number }[]) {
      platUserTotals.set(
        a.user_id,
        (platUserTotals.get(a.user_id) || 0) + a.active_seconds
      );
    }
    const platUsers = [...platUserTotals.values()];
    // Count unique days in range
    const platDays = new Set(
      (platformActivity as { activity_date: string }[]).map((a) => a.activity_date)
    ).size || 1;
    const avgPlatformMinutesPerDay =
      platUsers.length > 0
        ? platUsers.reduce((s, v) => s + v, 0) / platUsers.length / 60 / platDays
        : 0;
    // Total per-user avg (total minutes across whole period)
    const avgPlatformMinutesTotal =
      platUsers.length > 0
        ? platUsers.reduce((s, v) => s + v, 0) / platUsers.length / 60
        : 0;

    // Previous period platform time
    const prevPlatUserTotals = new Map<string, number>();
    for (const a of platformActivityPrev as { user_id: string; active_seconds: number }[]) {
      prevPlatUserTotals.set(
        a.user_id,
        (prevPlatUserTotals.get(a.user_id) || 0) + a.active_seconds
      );
    }
    const prevPlatUsers = [...prevPlatUserTotals.values()];
    const prevPlatDays = new Set(
      (platformActivityPrev as { activity_date?: string }[])
        .map((a) => a.activity_date)
        .filter(Boolean)
    ).size || 1;
    const prevAvgPlatPerDay =
      prevPlatUsers.length > 0
        ? prevPlatUsers.reduce((s, v) => s + v, 0) / prevPlatUsers.length / 60 / prevPlatDays
        : 0;

    // ── Geographic (with institution breakdown) ──
    const geoMap = new Map<
      string,
      {
        students: number;
        institutions: Map<string, { name: string; students: number }>;
        sessions: number;
      }
    >();
    for (const s of students) {
      const est = allEsts.find((e) => e.id === s.establishment_id);
      const c = est?.country || "Desconocido";
      if (!geoMap.has(c))
        geoMap.set(c, { students: 0, institutions: new Map(), sessions: 0 });
      const entry = geoMap.get(c)!;
      entry.students++;
      if (s.establishment_id && est) {
        const inst = entry.institutions.get(s.establishment_id) || {
          name: est.name,
          students: 0,
        };
        inst.students++;
        entry.institutions.set(s.establishment_id, inst);
      }
    }
    for (const conv of conversations) {
      const student = students.find((s) => s.id === conv.student_id);
      const est = allEsts.find((e) => e.id === student?.establishment_id);
      const c = est?.country || "Desconocido";
      if (geoMap.has(c)) geoMap.get(c)!.sessions++;
    }
    const mapData = Array.from(geoMap.entries())
      .filter(([c]) => c !== "Desconocido")
      .map(([country, data]) => ({
        country,
        students: data.students,
        institutions: Array.from(data.institutions.values()),
        sessions: data.sessions,
      }))
      .sort((a, b) => b.students - a.students);

    // ── Funnel (lifetime, not date-filtered) ──
    const studentsLoggedIn = new Set(
      lifetimeConvs.map((c) => c.student_id)
    ).size;
    const studentsOneSession = new Set(
      lifetimeConvs
        .filter((c) => c.status === "completed")
        .map((c) => c.student_id)
    ).size;
    const lifetimePerStudent = new Map<string, number>();
    for (const c of lifetimeConvs) {
      if (c.status === "completed") {
        lifetimePerStudent.set(
          c.student_id,
          (lifetimePerStudent.get(c.student_id) || 0) + 1
        );
      }
    }
    const studentsThreePlus = [...lifetimePerStudent.entries()].filter(
      ([, v]) => v >= 3
    ).length;
    const studentsSelfEval = new Set(
      selfEvals.map((f) => f.student_id)
    ).size;
    const studentsTeacherEval = new Set(
      competencies
        .filter((c) => c.feedback_status === "approved")
        .map((c) => c.student_id)
    ).size;

    // ── Competency averages ──
    const compKeys = [
      "setting_terapeutico",
      "motivo_consulta",
      "datos_contextuales",
      "objetivos",
      "escucha_activa",
      "actitud_no_valorativa",
      "optimismo",
      "presencia",
      "conducta_no_verbal",
      "contencion_afectos",
    ];
    const compAvgs: Record<string, number> = {};
    const compsInPeriod = competencies.filter((c) =>
      convIds.has(c.conversation_id)
    );
    for (const key of compKeys) {
      const vals = compsInPeriod
        .map((c) => Number((c as Record<string, unknown>)[key]))
        .filter((v) => v > 0);
      compAvgs[key] =
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) /
            10
          : 0;
    }

    // ── Alerts ──
    const { data: riskConvs } = await admin
      .from("conversations")
      .select(
        "id, ai_patients(tags), session_competencies(feedback_status)"
      )
      .in("student_id", safeIds)
      .eq("status", "completed")
      .limit(200);

    const riskTags = [
      "ideacion",
      "suicida",
      "autolesion",
      "crisis",
      "riesgo",
    ];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const riskPending = (riskConvs || []).filter((s: any) => {
      const tags = s.ai_patients?.tags || [];
      const hasRisk = tags.some((t: string) =>
        riskTags.some((r) => t.toLowerCase().includes(r))
      );
      const isPending =
        !s.session_competencies?.[0] ||
        s.session_competencies[0]?.feedback_status === "pending";
      return hasRisk && isPending;
    }).length;

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentStudents } = await admin
      .from("conversations")
      .select("student_id")
      .in("student_id", safeIds)
      .gte("started_at", weekAgo);
    const inactiveStudents = Math.max(
      0,
      totalStudents -
        new Set((recentStudents || []).map((s) => s.student_id)).size
    );
    const pendingReviews = competencies.filter(
      (c) => c.feedback_status === "pending"
    ).length;

    // ── Charts: Sessions per day ──
    const sessionsPerDayMap = new Map<string, number>();
    for (
      let d = new Date(from);
      d <= new Date(to);
      d.setDate(d.getDate() + 1)
    ) {
      sessionsPerDayMap.set(d.toISOString().split("T")[0], 0);
    }
    for (const c of conversations) {
      const date = c.started_at?.split("T")[0];
      if (date) sessionsPerDayMap.set(date, (sessionsPerDayMap.get(date) || 0) + 1);
    }
    const sessionsPerDay = Array.from(sessionsPerDayMap.entries())
      .map(([date, sessions]) => ({ date, sessions }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly score
    const weekScoreMap = new Map<string, { sum: number; count: number }>();
    for (const c of compsInPeriod) {
      const conv = conversations.find((cv) => cv.id === c.conversation_id);
      if (!conv?.started_at) continue;
      const d = new Date(conv.started_at);
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      const wk = ws.toISOString().split("T")[0];
      if (!weekScoreMap.has(wk))
        weekScoreMap.set(wk, { sum: 0, count: 0 });
      const e = weekScoreMap.get(wk)!;
      e.sum += Number(c.overall_score_v2);
      e.count++;
    }
    const weeklyScore = Array.from(weekScoreMap.entries())
      .map(([week, { sum, count }]) => ({
        week,
        score: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Registrations per week
    const regMap = new Map<string, number>();
    for (const s of students) {
      const d = new Date(s.created_at);
      if (d >= fromDate && d <= toDate) {
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        const wk = ws.toISOString().split("T")[0];
        regMap.set(wk, (regMap.get(wk) || 0) + 1);
      }
    }
    const registrations = Array.from(regMap.entries())
      .map(([week, count]) => ({ week, registrations: count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // By establishment
    const estStats = new Map<
      string,
      {
        name: string;
        students: number;
        sessions: number;
        scoreSum: number;
        scoreCount: number;
      }
    >();
    for (const s of students) {
      const est = allEsts.find((e) => e.id === s.establishment_id);
      const name = est?.name || "Sin institución";
      if (!estStats.has(name))
        estStats.set(name, {
          name,
          students: 0,
          sessions: 0,
          scoreSum: 0,
          scoreCount: 0,
        });
      estStats.get(name)!.students++;
    }
    for (const c of conversations) {
      const s = students.find((st) => st.id === c.student_id);
      const est = allEsts.find((e) => e.id === s?.establishment_id);
      const name = est?.name || "Sin institución";
      if (estStats.has(name)) estStats.get(name)!.sessions++;
    }
    for (const c of compsInPeriod) {
      const s = students.find((st) => st.id === c.student_id);
      const est = allEsts.find((e) => e.id === s?.establishment_id);
      const name = est?.name || "Sin institución";
      if (estStats.has(name)) {
        estStats.get(name)!.scoreSum += Number(c.overall_score_v2);
        estStats.get(name)!.scoreCount++;
      }
    }
    const byEstablishment = Array.from(estStats.values()).map((e) => ({
      name: e.name,
      students: e.students,
      sessions: e.sessions,
      avgScore:
        e.scoreCount > 0
          ? Math.round((e.scoreSum / e.scoreCount) * 10) / 10
          : 0,
    }));

    // Heatmap
    const heatmap: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0)
    );
    for (const c of conversations) {
      if (c.started_at) {
        const d = new Date(c.started_at);
        heatmap[d.getUTCDay()][d.getUTCHours()]++;
      }
    }

    // ── Research ──
    const [{ data: opportunities }, { data: insights }] = await Promise.all([
      admin
        .from("research_opportunities")
        .select("id, name, type, status, deadline, url")
        .order("deadline"),
      admin
        .from("research_insights")
        .select(
          "id, title, priority, category, sample_size, statistical_sig, suggested_venues, suggested_paper_type, status"
        )
        .order("created_at", { ascending: false }),
    ]);

    const opps = (opportunities || []).filter((o) => o.type !== "grant");
    const fundsData = (opportunities || []).filter((o) => o.type === "grant");
    const oppByStatus: Record<string, number> = {};
    for (const o of opps)
      oppByStatus[o.status] = (oppByStatus[o.status] || 0) + 1;
    const fundByStatus: Record<string, number> = {};
    for (const f of fundsData)
      fundByStatus[f.status] = (fundByStatus[f.status] || 0) + 1;

    const todayStr = new Date().toISOString().split("T")[0];
    const deadlines = (opportunities || [])
      .filter((o) => o.deadline && o.deadline >= todayStr)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        name: o.name,
        deadline: o.deadline,
        days: Math.ceil(
          (new Date(o.deadline + "T12:00:00").getTime() - Date.now()) / 86400000
        ),
        url: o.url,
      }));

    const allInsights = insights || [];

    return NextResponse.json({
      firstName: profile.full_name?.split(" ")[0] || "Admin",
      kpis: {
        totalStudents,
        activeStudents,
        onlineNow,
        inSession,
        platformMinutesToday,
        avgSessionMinutes: Math.round(avgTimeMinutes * 10) / 10,
        avgPlatformMinutesPerDay: Math.round(avgPlatformMinutesPerDay * 10) / 10,
        avgPlatformMinutesTotal: Math.round(avgPlatformMinutesTotal * 10) / 10,
        firstSessionScore: Math.round(firstSessionScore * 10) / 10,
        selfEvaluations: {
          completed: selfEvalStudents.size,
          total: withOne,
        },
        teacherEvaluations: {
          completed: teacherEvalStudents.size,
          total: withOne,
        },
        returnRate,
        pilots: { active: activePilots, completed: completedPilots },
      },
      trends: {
        totalStudents: pct(totalStudents, prevStudentCount),
        activeStudents: pct(activeStudents, prevActive),
        avgSessionMinutes: pct(avgTimeMinutes, prevAvg),
        avgPlatformMinutes: pct(avgPlatformMinutesPerDay, prevAvgPlatPerDay),
      },
      mapData,
      funnel: {
        enrolled: totalStudents,
        loggedIn: studentsLoggedIn,
        oneSession: studentsOneSession,
        threePlusSessions: studentsThreePlus,
        selfEvalDone: studentsSelfEval,
        teacherEvalDone: studentsTeacherEval,
      },
      competencies: compAvgs,
      alerts: { riskPending, inactiveStudents, pendingReviews },
      charts: {
        sessionsPerDay,
        weeklyScore,
        registrations,
        byEstablishment,
        heatmap,
      },
      research: {
        opportunities: oppByStatus,
        funds: fundByStatus,
        deadlines,
        insights: allInsights.filter(
          (i) => !["publicado", "descartado"].includes(i.status)
        ),
        achievements: {
          published: allInsights.filter((i) => i.status === "publicado").length,
          inDevelopment: allInsights.filter((i) => i.status === "en desarrollo")
            .length,
          acceptedConferences: opps.filter((o) => o.status === "accepted")
            .length,
          acceptedFunds: fundsData.filter((o) => o.status === "accepted")
            .length,
        },
      },
      filters: {
        countries,
        establishments: allEsts.map((e) => ({
          id: e.id,
          name: e.name,
          country: e.country,
        })),
        courses: (rawCourses || []).map((c) => ({
          id: c.id,
          name: c.name,
          establishment_id: c.establishment_id,
        })),
        sections: (rawSections || []).map((s) => ({
          id: s.id,
          name: s.name,
          course_id: s.course_id,
        })),
      },
      isSuperadmin,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error loading dashboard";
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
