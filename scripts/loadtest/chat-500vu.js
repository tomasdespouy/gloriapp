/**
 * Load test: 500 concurrent students each sending 5 chat turns.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://gloriapp-pgf2.vercel.app scripts/loadtest/chat-500vu.js
 *
 * Optional env:
 *   BASE_URL          target deployment (default: https://gloriapp-pgf2.vercel.app)
 *   USER_COUNT        max VUs (default: 500)
 *   PATIENT_ID        skip the patient lookup and pin a specific UUID
 *   STUDENT_PASSWORD  password used by all loadtest_NNN users (default: LoadTest2026!)
 *
 * Outputs:
 *   - stdout summary (auto-printed by k6)
 *   - scripts/loadtest/results/summary.json (machine-readable)
 *   - scripts/loadtest/results/report.html  (for the pitch deck)
 */

import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import { SharedArray } from "k6/data";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// ── config ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://gloriapp-pgf2.vercel.app";
const USER_COUNT = parseInt(__ENV.USER_COUNT || "500", 10);
const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || "LoadTest2026!";
const TURNS_PER_USER = 5;

// Custom metrics for the report
const turnLatency = new Trend("turn_latency_ms", true);
const loginLatency = new Trend("login_latency_ms", true);
const ttfbChat = new Trend("chat_ttfb_ms", true);
const turnsCompleted = new Counter("turns_completed");
const turnFailures = new Counter("turn_failures");
const turnSuccessRate = new Rate("turn_success_rate");

// Pre-built list of test user emails (1 per VU)
const users = new SharedArray("users", () => {
  const arr = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    arr.push({
      email: `loadtest_${String(i).padStart(3, "0")}@loadtest.local`,
      password: STUDENT_PASSWORD,
    });
  }
  return arr;
});

// ── stages ───────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    chat_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: USER_COUNT },  // ramp 0 → USER_COUNT in 5 min
        { duration: "5m", target: USER_COUNT },  // hold for 5 min
        { duration: "1m", target: 0 },           // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "turn_latency_ms": ["p(95)<8000", "p(99)<15000"],
    "turn_success_rate": ["rate>0.98"],
    "http_req_failed": ["rate<0.02"],
  },
};

// ── setup: pick a patient ID once ─────────────────────────────────────────────
export function setup() {
  if (__ENV.PATIENT_ID) {
    console.log(`Using pinned PATIENT_ID=${__ENV.PATIENT_ID}`);
    return { patientId: __ENV.PATIENT_ID };
  }

  console.log("setup(): logging in as loadtest_001 to discover a patient ID");
  const jar = http.cookieJar();
  jar.clear(BASE_URL);

  const loginRes = http.post(
    `${BASE_URL}/api/loadtest/login`,
    JSON.stringify({ email: users[0].email, password: users[0].password }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (loginRes.status !== 200) {
    fail(`setup login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const patientsRes = http.get(`${BASE_URL}/api/patients`);
  if (patientsRes.status !== 200) {
    fail(`setup GET /api/patients failed: ${patientsRes.status}`);
  }

  let list;
  try { list = patientsRes.json(); } catch { fail(`patients body not JSON: ${patientsRes.body}`); }
  const active = (list || []).filter((p) => p.is_active);
  if (active.length === 0) fail("no active patients found in staging");

  const patientId = active[0].id;
  console.log(`setup() picked patient: ${active[0].name} (${patientId})`);
  return { patientId };
}

// ── default: each VU runs this once ──────────────────────────────────────────
export default function (data) {
  const u = users[(__VU - 1) % users.length];

  // 1) login (per VU, first iteration)
  const t0 = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/loadtest/login`,
    JSON.stringify({ email: u.email, password: u.password }),
    { headers: { "Content-Type": "application/json" }, tags: { phase: "login" } },
  );
  loginLatency.add(Date.now() - t0);

  if (
    !check(loginRes, {
      "login 200": (r) => r.status === 200,
    })
  ) {
    turnFailures.add(TURNS_PER_USER);
    return;
  }

  // 2) send TURNS_PER_USER messages with a realistic gap between them
  let conversationId = null;

  for (let turn = 1; turn <= TURNS_PER_USER; turn++) {
    const start = Date.now();
    const body = {
      patientId: data.patientId,
      message: `Mensaje de prueba ${turn} desde VU ${__VU}`,
    };
    if (conversationId) body.conversationId = conversationId;

    const res = http.post(`${BASE_URL}/api/chat`, JSON.stringify(body), {
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      tags: { phase: "chat", turn: String(turn) },
      timeout: "60s",
    });

    const elapsed = Date.now() - start;
    turnLatency.add(elapsed);
    ttfbChat.add(res.timings.waiting);

    const ok = check(res, {
      "chat 200": (r) => r.status === 200,
      "chat has done event": (r) => typeof r.body === "string" && r.body.includes('"type":"done"'),
    });

    if (ok) {
      turnsCompleted.add(1);
      turnSuccessRate.add(true);

      // capture conversationId on first turn
      if (!conversationId && typeof res.body === "string") {
        const m = res.body.match(/"conversation_id"[^}]*"value"\s*:\s*"([a-f0-9-]+)"/);
        if (m) conversationId = m[1];
      }
    } else {
      turnFailures.add(1);
      turnSuccessRate.add(false);
    }

    // think-time between turns: 8-15s (real student pauses to think/type)
    sleep(8 + Math.random() * 7);
  }
}

// ── handleSummary: emit JSON + HTML report for the pitch deck ────────────────
export function handleSummary(data) {
  return {
    "scripts/loadtest/results/summary.json": JSON.stringify(data, null, 2),
    "scripts/loadtest/results/report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
