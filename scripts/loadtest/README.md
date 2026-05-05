# Load test — 500 concurrent students

Stress-tests the GlorIA platform with 500 simultaneous virtual users running a
full chat session (login + 5 turns each), to produce numbers and a visual
report for the sales pitch.

The LLM is **mocked** so the test measures only platform infrastructure
(Vercel routes + Supabase + rate limiter). A separate note in the report covers
the LLM as the real bottleneck under tier-1 quotas.

## What runs where

| Component | Lives in | Notes |
| --- | --- | --- |
| Mock LLM provider | `src/lib/ai.ts` | Activated when `LLM_PROVIDER=mock` is set in the deployed environment |
| Login helper | `src/app/api/loadtest/login/route.ts` | Returns 404 unless `LLM_PROVIDER=mock` |
| Test users seed | `scripts/loadtest/seed-test-users.mjs` | Creates 500 `loadtest_NNN@loadtest.local` users in **staging only** |
| k6 script | `scripts/loadtest/chat-500vu.js` | Ramp 0→500 over 5 min, hold 5 min, ramp down |
| Cleanup | `scripts/loadtest/cleanup-test-users.mjs` | Removes every `loadtest_*@loadtest.local` user |

## Prerequisites

1. **Branch deployed to staging.** Push `loadtest/staging-500vu` (or merge it
   into the staging branch) so Vercel deploys it to `gloriapp-pgf2.vercel.app`.
2. **Env vars set in Vercel staging:**
   - `LLM_PROVIDER=mock`
   - All existing Supabase staging keys
3. **Local file `scripts/loadtest/.env.staging`** with values from the staging
   project (Supabase Dashboard → Project Settings → API). See
   `.env.staging.example`. This file is gitignored.
4. **k6 installed.** `winget install k6` on Windows. Binary lives at
   `C:\Program Files\k6\k6.exe`.

## Run sequence

```powershell
# 1) Seed 500 test users into staging Supabase
node --env-file=scripts/loadtest/.env.staging scripts/loadtest/seed-test-users.mjs

# 2) Run the load test (writes report to scripts/loadtest/results/)
& "C:\Program Files\k6\k6.exe" run `
  --env BASE_URL=https://gloriapp-pgf2.vercel.app `
  scripts/loadtest/chat-500vu.js

# 3) Open the HTML report (the artifact for the pitch deck)
start scripts/loadtest/results/report.html

# 4) Delete every test user + cascading conversations/messages
node --env-file=scripts/loadtest/.env.staging scripts/loadtest/cleanup-test-users.mjs
```

The full run takes ~12 minutes (5 min ramp + 5 min hold + 1 min ramp-down +
overhead).

## Reading the report

The `report.html` shows:
- **Concurrent VUs over time** — proof the test actually held 500 users
- **p50 / p95 / p99 latency** — what each turn took end-to-end
- **Throughput** — requests per second
- **Error rate** — percent of failed turns
- **Custom metrics** — `turn_latency_ms`, `chat_ttfb_ms`, `login_latency_ms`

The thresholds in `chat-500vu.js` are conservative for sales-deck use:
- p95 turn latency < 8s
- p99 turn latency < 15s
- success rate > 98%
- HTTP failure rate < 2%

If a threshold fails, k6 exits non-zero and the report flags it. Surface that
honestly — a "we had X% errors at 500 concurrent" datapoint is better than
hiding it.

## Honest framing for sales

Two numbers belong in the deck side by side:

1. **Platform infrastructure capacity (this test)**
   *Vercel routes + Supabase + rate limiter, with the LLM mocked.*
   Expected outcome: 500 concurrent sustained, p95 turn latency in the 1–3 s
   range, error rate under 1 %.

2. **End-to-end capacity with the real LLM**
   *Limited by OpenAI/Gemini tier quotas (TPM, not infra).*
   At Tier 1 the platform tops out around 10–30 sustained concurrent
   conversations regardless of infrastructure. Higher tiers scale linearly.

Selling only (1) without (2) invites a technical buyer to point out the LLM
ceiling. Putting both up front is more credible.

## Safety checks built in

- `seed-test-users.mjs` and `cleanup-test-users.mjs` both refuse to run unless
  `NEXT_PUBLIC_SUPABASE_URL` contains the staging ref `vhkbbpsdiklguxvjrksd`.
- `/api/loadtest/login` returns 404 unless `LLM_PROVIDER=mock`.
- The mock provider only activates on the explicit env var; it never affects
  production deployments.

## Files added by this branch

- `src/lib/ai.ts` — added `LLM_PROVIDER=mock` branch (canned responses + delay)
- `src/app/api/loadtest/login/route.ts` — gated login helper
- `scripts/loadtest/seed-test-users.mjs`
- `scripts/loadtest/cleanup-test-users.mjs`
- `scripts/loadtest/chat-500vu.js`
- `scripts/loadtest/.env.staging.example`
- `scripts/loadtest/README.md` (this file)
- `.gitignore` — added `scripts/loadtest/results/`
