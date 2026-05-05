#!/usr/bin/env node
/**
 * Cleanup test users created by seed-test-users.mjs.
 *
 * USAGE:
 *   node --env-file=scripts/loadtest/.env.staging scripts/loadtest/cleanup-test-users.mjs
 *
 * Deletes every auth.users row whose email matches loadtest_*@loadtest.local.
 * The CASCADE delete on profiles + conversations + messages handles the rest.
 *
 * Refuses to run if URL does not point at the staging project.
 */

import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "vhkbbpsdiklguxvjrksd";
const EMAIL_DOMAIN = "loadtest.local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

if (!SUPABASE_URL.includes(STAGING_REF)) {
  console.error(`ABORT: SUPABASE_URL does not point at staging (expected ref ${STAGING_REF}).`);
  console.error(`Got: ${SUPABASE_URL}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log(`Cleaning up loadtest_*@${EMAIL_DOMAIN} users from staging...`);
const startTime = Date.now();

// Page through auth.users and collect IDs whose email matches the pattern.
let allTestUsers = [];
let page = 1;
const PER_PAGE = 100;

while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  const users = data?.users ?? [];
  if (users.length === 0) break;

  for (const u of users) {
    if (u.email && u.email.endsWith(`@${EMAIL_DOMAIN}`) && u.email.startsWith("loadtest_")) {
      allTestUsers.push({ id: u.id, email: u.email });
    }
  }

  if (users.length < PER_PAGE) break;
  page++;
}

console.log(`  Found ${allTestUsers.length} test users to delete.`);
if (allTestUsers.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

let deleted = 0, errored = 0;
const CONCURRENCY = 10;

async function deleteOne(user) {
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`  ${user.email}: ${error.message}`);
    errored++;
  } else {
    deleted++;
  }
}

for (let i = 0; i < allTestUsers.length; i += CONCURRENCY) {
  const batch = allTestUsers.slice(i, i + CONCURRENCY).map(deleteOne);
  await Promise.all(batch);
  const done = Math.min(i + CONCURRENCY, allTestUsers.length);
  if (done % 50 === 0 || done === allTestUsers.length) {
    console.log(`  Progress: ${done}/${allTestUsers.length} (deleted=${deleted}, err=${errored})`);
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\nDone in ${elapsed}s.`);
console.log(`  Deleted: ${deleted}`);
console.log(`  Errored: ${errored}`);
