/**
 * READ-ONLY: verifica que la lógica nueva de cappedActiveSeconds en
 * pilot-report-data.ts produce el avg esperado para el piloto Cuyo
 * (objetivo: ~22m en lugar de 214m).
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const env = dotenv.parse(fs.readFileSync(".env.production"));

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ABSOLUTE_CAP_SECONDS = 5400;
const WALL_CLOCK_GRACE_SECONDS = 300;

function cappedActiveSeconds(c) {
  const raw = c.active_seconds;
  if (typeof raw !== "number" || raw <= 0) return 0;
  let cap = ABSOLUTE_CAP_SECONDS;
  if (c.started_at && c.ended_at) {
    const wall = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000;
    if (wall > 0) cap = Math.min(cap, wall + WALL_CLOCK_GRACE_SECONDS);
  }
  return Math.min(raw, cap);
}

const fmt = (s) => `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;

(async () => {
  const { data: pilots } = await supa
    .from("pilots")
    .select("id, name, institution")
    .order("scheduled_at", { ascending: false });

  console.log("PILOTO".padEnd(40), "| AVG ANTES   | AVG DESPUÉS | N");
  console.log("─".repeat(85));

  for (const pilot of pilots) {
    const { data: parts } = await supa
      .from("pilot_participants")
      .select("user_id")
      .eq("pilot_id", pilot.id)
      .eq("role", "student");
    const userIds = (parts || []).map(p => p.user_id).filter(Boolean);
    if (userIds.length === 0) continue;

    const { data: convs } = await supa
      .from("conversations")
      .select("active_seconds, started_at, ended_at")
      .in("student_id", userIds);
    const valid = (convs || []).filter(c => typeof c.active_seconds === "number" && c.active_seconds > 0);
    if (valid.length === 0) continue;

    const avgBefore = valid.reduce((a, c) => a + c.active_seconds, 0) / valid.length;
    const cappedSecs = valid.map(cappedActiveSeconds).filter(v => v > 0);
    const avgAfter = cappedSecs.reduce((a, b) => a + b, 0) / cappedSecs.length;

    const changed = Math.abs(avgBefore - avgAfter) > 10 ? " <— CAMBIA" : "";
    console.log(
      pilot.name.slice(0, 40).padEnd(40),
      "|", fmt(avgBefore).padStart(10),
      "|", fmt(avgAfter).padStart(10),
      "| n=" + valid.length + changed
    );
  }
})();
