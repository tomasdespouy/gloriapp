// Lista el contenido del bucket gloria1-archive (PROD)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = {};
for (const raw of readFileSync(".env.production", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}
console.log("url:", env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40));
console.log("key:", env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + "...");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function walk(prefix) {
  const { data, error } = await sb.storage
    .from("gloria1-archive")
    .list(prefix, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error) {
    console.error("ERR", prefix, error);
    return;
  }
  for (const f of data) {
    const full = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.id === null) {
      // folder
      console.log(`[dir] ${full}/`);
      await walk(full);
    } else {
      const kb = (f.metadata?.size / 1024).toFixed(1);
      console.log(`   ${full}  (${kb} KB)`);
    }
  }
}

await walk("");
