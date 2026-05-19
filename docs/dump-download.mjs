// Descarga el contenido de mysql-dump/ y supabase-piloto-t3-2025/
// del bucket gloria1-archive al directorio local gloria1-dump/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const env = {};
for (const raw of readFileSync(".env.production", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PREFIXES = ["mysql-dump", "supabase-piloto-t3-2025"];
const OUT = "gloria1-dump";

mkdirSync(OUT, { recursive: true });

for (const prefix of PREFIXES) {
  const { data, error } = await sb.storage
    .from("gloria1-archive")
    .list(prefix, { limit: 100 });
  if (error) {
    console.error("list error", prefix, error);
    continue;
  }
  mkdirSync(path.join(OUT, prefix), { recursive: true });
  for (const f of data) {
    const remote = `${prefix}/${f.name}`;
    const local = path.join(OUT, prefix, f.name);
    process.stdout.write(`  ${remote} ... `);
    const { data: blob, error: dlErr } = await sb.storage
      .from("gloria1-archive")
      .download(remote);
    if (dlErr) {
      console.log(`ERR ${dlErr.message}`);
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    writeFileSync(local, buf);
    console.log(`${(buf.length / 1024).toFixed(1)} KB`);
  }
}
console.log("\nDone. Files at ./gloria1-dump/");
