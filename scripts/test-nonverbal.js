/**
 * Test 15 random patients to verify non-verbal is in third person
 * Usage: node scripts/test-nonverbal.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASH = "C:\\Program Files\\Git\\usr\\bin\\bash.exe";
const DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const supabase = createClient(
  "https://ndwmnxlwbfqfwwtekjun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kd21ueGx3YmZxZnd3dGVranVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyOTk4OCwiZXhwIjoyMDg5MDA1OTg4fQ.ImxlaY4rFzq9gQrqBitJjzAfZKdFppmT98dpeOU-YSE"
);

function curl(args) {
  return execSync(`cd "${DIR}" && curl -s ${args}`, {
    encoding: "utf8",
    shell: BASH,
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function main() {
  const { data: patients } = await supabase
    .from("ai_patients")
    .select("name, system_prompt")
    .eq("is_active", true);

  // Pick 15 random
  const shuffled = patients.sort(() => Math.random() - 0.5).slice(0, 15);

  console.log("Testing 15 random patients for non-verbal (third person)...\n");

  let pass = 0;
  let fail = 0;

  for (const p of shuffled) {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: p.system_prompt },
        { role: "user", content: "Hola, mucho gusto. Cuéntame, ¿cómo estás? ¿Qué te trae por aquí?" },
      ],
      max_tokens: 200,
      temperature: 0.8,
    };

    fs.writeFileSync(path.resolve(__dirname, "../.tmp_test.json"), JSON.stringify(body));

    try {
      const result = JSON.parse(
        curl(
          `-X POST 'https://api.openai.com/v1/chat/completions' ` +
          `-H 'Authorization: Bearer ${OPENAI_KEY}' ` +
          `-H 'Content-Type: application/json' ` +
          `-d @.tmp_test.json --max-time 30`
        )
      );

      const reply = result.choices?.[0]?.message?.content || "";

      // Extract all bracketed content
      const brackets = reply.match(/\[([^\]]+)\]/g) || [];

      // Check for first-person markers inside brackets
      const firstPerson = brackets.filter((b) =>
        /\b(me |mi |mis |miro|siento|estoy|juego|suspiro|sonrío|cruzo|encojo|acomodo|muerdo|toco|agarro)\b/i.test(b)
      );

      const status = firstPerson.length === 0 ? "PASS" : "FAIL";
      if (status === "PASS") pass++;
      else fail++;

      console.log(`${status} | ${p.name}`);
      if (brackets.length > 0) console.log(`     Brackets: ${brackets.join(" ")}`);
      if (firstPerson.length > 0) console.log(`     FIRST PERSON: ${firstPerson.join(" ")}`);
      console.log(`     Reply: ${reply.substring(0, 130)}...`);
      console.log("");
    } catch (err) {
      console.log(`ERR  | ${p.name}: ${err.message.substring(0, 80)}`);
    }
  }

  try { fs.unlinkSync(path.resolve(__dirname, "../.tmp_test.json")); } catch {}

  console.log("\n========================================");
  console.log(`RESULTS: ${pass} PASS, ${fail} FAIL out of ${pass + fail}`);
  console.log("========================================");
}

main().catch(console.error);
