/**
 * LOAD TEST: simulate N concurrent students chatting with random patients
 * for M minutes. Used to validate the platform under realistic pilot load.
 *
 * Usage:
 *   node scripts/load-test-pilot.js                            # default 60 users / 20 min
 *   node scripts/load-test-pilot.js --users=10 --duration=5    # smaller test
 *   node scripts/load-test-pilot.js --target=https://app...    # against prod
 *   node scripts/load-test-pilot.js --cleanup                  # delete test users after
 *
 * Flags:
 *   --users=N         Number of concurrent users (default 60)
 *   --duration=M      Minutes each user stays active (default 20)
 *   --think-min=S     Min seconds between messages per user (default 30)
 *   --think-max=S     Max seconds between messages per user (default 90)
 *   --target=URL      Base URL of the app (default http://localhost:3000)
 *   --cleanup         Delete test users + their conversations at the end
 *   --dry-run         Just create users and verify auth, don't actually chat
 *
 * IMPORTANT:
 *   - Test users use email pattern: loadtest+NNN@glor-ia.com
 *   - LLM usage WILL incur cost (~$1-2 USD per full 60-user / 20-min test)
 *   - Default target is localhost — be explicit if you want to test prod
 */

const { createClient: createAdminClient } = require("@supabase/supabase-js");
const { createBrowserClient } = require("@supabase/ssr");
require("dotenv").config({ path: ".env.local" });

// ─── Config ─────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    }
    return [a, true];
  })
);

const N_USERS = parseInt(args.users || "60");
const DURATION_MIN = parseFloat(args.duration || "20");
const THINK_MIN = parseInt(args["think-min"] || "30");
const THINK_MAX = parseInt(args["think-max"] || "90");
const TARGET = args.target || "http://localhost:3000";
const CLEANUP = !!args.cleanup;
const DRY_RUN = !!args["dry-run"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON || !SUPABASE_SERVICE) {
  console.error("ERROR: faltan variables de entorno en .env.local");
  process.exit(1);
}

const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Test data ─────────────────────────────────────────────
const THERAPIST_MSGS = [
  "Hola, bienvenido. ¿Cómo te encuentras hoy?",
  "Cuéntame, ¿qué te trae a consulta?",
  "¿Puedes contarme un poco más sobre eso?",
  "Entiendo. ¿Desde cuándo te has sentido así?",
  "¿Cómo te hace sentir esa situación?",
  "¿Hay algo más que quieras compartir sobre esto?",
  "Si entiendo bien, lo que me dices es que te has sentido sobrepasado.",
  "¿Qué crees que podría ayudarte en este momento?",
  "¿Cómo ha afectado esto tu vida diaria?",
  "¿Has podido hablar con alguien más sobre esto?",
  "Parece que esto te genera mucha angustia.",
  "¿Qué significaría para ti resolver esta situación?",
  "Noto que esto es importante para ti.",
  "¿Qué te gustaría que fuera diferente?",
  "Muchas personas se sienten así en situaciones similares.",
  "¿Qué recursos sientes que tienes para enfrentar esto?",
  "Me parece que estás siendo muy valiente al hablar de esto.",
  "¿Qué expectativas tienes de este proceso terapéutico?",
  "¿Cómo describirías un día típico para ti en este momento?",
  "¿Qué cambiarías si pudieras?",
  "Cuéntame sobre tu familia, ¿cómo te llevas con ellos?",
  "¿Has notado cambios en tu sueño o tu apetito?",
  "Me gustaría entender mejor qué pasó esa vez que mencionaste.",
  "¿Cómo lo enfrentaste en su momento?",
  "¿Qué cosas haces para cuidarte cuando te sientes así?",
];

// ─── Helpers ───────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => n.toFixed(0).padStart(3, " ");

function buildCookieJar() {
  const jar = {};
  return {
    jar,
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    setAll: (toSet) => {
      for (const { name, value } of toSet) {
        if (value === "" || value == null) delete jar[name];
        else jar[name] = value;
      }
    },
    toHeader: () =>
      Object.entries(jar)
        .map(([n, v]) => `${n}=${v}`)
        .join("; "),
  };
}

// ─── Setup ─────────────────────────────────────────────────
async function ensureTestUsers(n) {
  console.log(`\n[setup] asegurando ${n} usuarios de prueba...`);
  const users = [];
  for (let i = 1; i <= n; i++) {
    const email = `loadtest+${String(i).padStart(3, "0")}@glor-ia.com`;
    const password = "LoadTest_2026!";

    // Try to create. If exists, fetch the existing one.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `LoadTest User ${i}`, role: "student" },
    });

    if (error && !error.message.includes("already")) {
      console.warn(`[setup] error creando ${email}: ${error.message}`);
      continue;
    }

    let userId = data?.user?.id;
    if (!userId) {
      // Already existed — fetch it
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email === email);
      if (existing) userId = existing.id;
    }

    if (userId) users.push({ email, password, userId });
  }
  console.log(`[setup] ${users.length}/${n} usuarios listos`);
  return users;
}

async function fetchPatients() {
  const { data: patients } = await admin
    .from("ai_patients")
    .select("id, name")
    .eq("is_active", true);
  return patients || [];
}

// ─── Per-user simulation ───────────────────────────────────
async function simulateUser(user, patient, durationMin, stats, label) {
  const cookieJar = buildCookieJar();
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: cookieJar.getAll,
      setAll: cookieJar.setAll,
    },
  });

  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signErr || !signIn?.session) {
    stats.loginErrors++;
    console.warn(`[${label}] login failed: ${signErr?.message}`);
    return;
  }
  stats.loggedIn++;

  if (DRY_RUN) return;

  const cookieHeader = cookieJar.toHeader();
  const start = Date.now();
  let conversationId = null;
  let msgIdx = Math.floor(Math.random() * THERAPIST_MSGS.length);

  while ((Date.now() - start) / 60000 < durationMin) {
    const message = THERAPIST_MSGS[msgIdx % THERAPIST_MSGS.length];
    msgIdx++;

    const t0 = Date.now();
    try {
      // Only include conversationId when we already have one — the schema is
      // .optional() which accepts missing/undefined, but NOT null.
      const body = { patientId: patient.id, message };
      if (conversationId) body.conversationId = conversationId;

      const res = await fetch(`${TARGET}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        stats.httpErrors++;
        const txt = await res.text().catch(() => "");
        if (stats.httpErrors <= 5) {
          console.warn(`[${label}] HTTP ${res.status}: ${txt.slice(0, 200)}`);
        }
      } else {
        // Read SSE stream and extract conversation_id from first event
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // Parse SSE frames as they come
          const frames = buf.split("\n\n");
          buf = frames.pop() || "";
          for (const frame of frames) {
            const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine.slice(6));
              if (evt.type === "conversation_id" && !conversationId) {
                conversationId = evt.value;
              }
            } catch { /* ignore parse errors */ }
          }
        }
        stats.messagesSent++;
        stats.totalLatencyMs += Date.now() - t0;
        stats.latencies.push(Date.now() - t0);
      }
    } catch (err) {
      stats.networkErrors++;
      if (stats.networkErrors <= 5) {
        console.warn(`[${label}] network: ${err.message}`);
      }
    }

    // Think time before next message (30-90s by default)
    const wait = rand(THINK_MIN, THINK_MAX) * 1000;
    // But not longer than the time we have left
    const elapsed = Date.now() - start;
    const remaining = durationMin * 60000 - elapsed;
    if (remaining <= 1000) break;
    await sleep(Math.min(wait, remaining));
  }
}

// ─── Cleanup ───────────────────────────────────────────────
async function cleanupUsers(users) {
  console.log(`\n[cleanup] eliminando ${users.length} usuarios + datos asociados...`);
  for (const u of users) {
    try {
      // Conversations + messages cascade via user FK
      await admin.from("conversations").delete().eq("student_id", u.userId);
      await admin.auth.admin.deleteUser(u.userId);
    } catch (err) {
      console.warn(`[cleanup] error eliminando ${u.email}: ${err.message}`);
    }
  }
  console.log("[cleanup] listo");
}

// ─── Reporter ──────────────────────────────────────────────
function startReporter(stats, totalUsers, durationMin) {
  const startTs = Date.now();
  const interval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTs) / 1000);
    const elapsedMin = (elapsedSec / 60).toFixed(1);
    const totalMs = stats.totalLatencyMs;
    const avgMs = stats.messagesSent > 0 ? totalMs / stats.messagesSent : 0;
    const errs = stats.httpErrors + stats.networkErrors + stats.loginErrors;
    process.stdout.write(
      `[${elapsedMin}min/${durationMin}min] usuarios:${stats.loggedIn}/${totalUsers}  msgs:${fmt(stats.messagesSent)}  ` +
        `errors:${fmt(errs)}  latencia avg:${fmt(avgMs)}ms\n`
    );
  }, 15000);
  return () => clearInterval(interval);
}

function printFinalReport(stats, totalUsers, durationMin, wallSec) {
  const errs = stats.httpErrors + stats.networkErrors + stats.loginErrors;
  const successRate = stats.messagesSent + errs > 0
    ? (100 * stats.messagesSent) / (stats.messagesSent + errs)
    : 0;
  const avgMs = stats.messagesSent > 0 ? stats.totalLatencyMs / stats.messagesSent : 0;

  // P50/P95
  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const p = (q) => sorted.length > 0 ? sorted[Math.floor(sorted.length * q)] : 0;

  console.log("\n══════════════════════════════════════════");
  console.log("           REPORTE FINAL DE CARGA");
  console.log("══════════════════════════════════════════");
  console.log(`  Target:               ${TARGET}`);
  console.log(`  Usuarios objetivo:    ${totalUsers}`);
  console.log(`  Usuarios logueados:   ${stats.loggedIn}`);
  console.log(`  Duración planeada:    ${durationMin} min`);
  console.log(`  Tiempo real:          ${(wallSec / 60).toFixed(1)} min`);
  console.log("  ─────────────────────────────────────────");
  console.log(`  Mensajes enviados:    ${stats.messagesSent}`);
  console.log(`  Errores HTTP:         ${stats.httpErrors}`);
  console.log(`  Errores red:          ${stats.networkErrors}`);
  console.log(`  Errores login:        ${stats.loginErrors}`);
  console.log(`  Tasa de éxito:        ${successRate.toFixed(1)}%`);
  console.log("  ─────────────────────────────────────────");
  console.log(`  Latencia promedio:    ${avgMs.toFixed(0)} ms`);
  console.log(`  Latencia P50:         ${p(0.5)} ms`);
  console.log(`  Latencia P95:         ${p(0.95)} ms`);
  console.log(`  Latencia P99:         ${p(0.99)} ms`);
  console.log("══════════════════════════════════════════\n");
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log("══════════════════════════════════════════");
  console.log("       LOAD TEST - GLORIA PILOT");
  console.log("══════════════════════════════════════════");
  console.log(`  Target:        ${TARGET}`);
  console.log(`  Usuarios:      ${N_USERS}`);
  console.log(`  Duración:      ${DURATION_MIN} min por usuario`);
  console.log(`  Think time:    ${THINK_MIN}-${THINK_MAX} s entre mensajes`);
  console.log(`  Cleanup:       ${CLEANUP ? "sí" : "no"}`);
  console.log(`  Dry run:       ${DRY_RUN ? "sí" : "no"}`);
  console.log("══════════════════════════════════════════");

  // 1. Verify target is reachable
  try {
    const r = await fetch(`${TARGET}/api/health`).catch(() => null);
    if (!r || !r.ok) {
      console.warn(`[warn] no se pudo verificar ${TARGET}/api/health (sigue igual, puede no existir el endpoint)`);
    }
  } catch { /* ignore */ }

  // 2. Setup users
  const users = await ensureTestUsers(N_USERS);
  if (users.length === 0) {
    console.error("[fatal] no se pudo crear ningún usuario, abortando");
    process.exit(1);
  }

  // 3. Get patient pool
  const patients = await fetchPatients();
  if (patients.length === 0) {
    console.error("[fatal] no hay pacientes activos en la base, abortando");
    process.exit(1);
  }
  console.log(`[setup] ${patients.length} pacientes disponibles`);

  // 4. Spin up parallel simulations
  const stats = {
    loggedIn: 0,
    messagesSent: 0,
    httpErrors: 0,
    networkErrors: 0,
    loginErrors: 0,
    totalLatencyMs: 0,
    latencies: [],
  };

  const stopReporter = startReporter(stats, users.length, DURATION_MIN);
  const startTs = Date.now();

  // Stagger logins: Supabase Auth rate-limits sign-ins per IP
  // (~30/5min on free tier, ~150/5min on Pro). When all users come from
  // the same IP (this script), we must space logins out to avoid 429s.
  // In a real pilot each user logs in from a different IP, so this isn't
  // a concern in production — only an artifact of synthetic load testing.
  // 5s × 60 = 300s (5 min) ramp-up = 12 logins/min, well below all tiers.
  const LOGIN_STAGGER_MS = 5000;

  await Promise.allSettled(
    users.map((u, i) => {
      const patient = pick(patients);
      const label = String(i + 1).padStart(3, "0");
      return sleep(i * LOGIN_STAGGER_MS).then(() =>
        simulateUser(u, patient, DURATION_MIN, stats, label)
      );
    })
  );

  stopReporter();
  const wallSec = (Date.now() - startTs) / 1000;
  printFinalReport(stats, users.length, DURATION_MIN, wallSec);

  // 5. Cleanup
  if (CLEANUP) {
    await cleanupUsers(users);
  } else {
    console.log("[info] usuarios de prueba NO eliminados. Usá --cleanup para limpiar.\n");
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
