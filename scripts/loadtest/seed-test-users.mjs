#!/usr/bin/env node
/**
 * Seed 500 test users into Supabase staging.
 *
 * USAGE:
 *   node --env-file=scripts/loadtest/.env.staging scripts/loadtest/seed-test-users.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env.
 * Refuses to run if URL does not point at the staging project.
 *
 * Idempotent: existing loadtest_* users are skipped.
 */

import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "vhkbbpsdiklguxvjrksd";
const COUNT = 500;
const PASSWORD = "LoadTest2026!";
const EMAIL_DOMAIN = "loadtest.local";
const CONCURRENCY = 10;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

if (!SUPABASE_URL.includes(STAGING_REF)) {
  console.error(`ABORT: SUPABASE_URL does not point at staging (expected ref ${STAGING_REF}).`);
  console.error(`Got: ${SUPABASE_URL}`);
  console.error("Refusing to run against any other environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log(`Seeding ${COUNT} test users into staging (${STAGING_REF})...`);
const startTime = Date.now();

let created = 0, skipped = 0, errored = 0;

async function seedOne(i) {
  const email = `loadtest_${String(i).padStart(3, "0")}@${EMAIL_DOMAIN}`;
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `LoadTest ${i}`,
      role: "student",
      loadtest: true,
    },
  });

  if (error) {
    if (error.message?.toLowerCase().includes("already") || error.code === "email_exists") {
      skipped++;
    } else {
      console.error(`  [${i}] ${email}: ${error.message}`);
      errored++;
    }
  } else {
    created++;
  }
}

// Process in batches of CONCURRENCY for speed without hammering Supabase auth admin
for (let batchStart = 1; batchStart <= COUNT; batchStart += CONCURRENCY) {
  const batch = [];
  for (let i = batchStart; i < batchStart + CONCURRENCY && i <= COUNT; i++) {
    batch.push(seedOne(i));
  }
  await Promise.all(batch);

  const done = Math.min(batchStart + CONCURRENCY - 1, COUNT);
  if (done % 50 === 0 || done === COUNT) {
    console.log(`  Progress: ${done}/${COUNT} (created=${created}, skipped=${skipped}, err=${errored})`);
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s.`);
console.log(`  Created: ${created}`);
console.log(`  Skipped (already existed): ${skipped}`);
console.log(`  Errored: ${errored}`);
console.log(`\nTest user credentials:`);
console.log(`  Email pattern: loadtest_NNN@${EMAIL_DOMAIN} (NNN = 001..${String(COUNT).padStart(3, "0")})`);
console.log(`  Password: ${PASSWORD}`);
