/**
 * Load test login helper.
 *
 * Authenticates a test user via email+password and lets the Supabase SSR
 * client write its auth cookies into the response. The k6 cookie jar will
 * then carry those cookies on subsequent requests so the rest of the app
 * sees a normal authenticated session.
 *
 * GATED: only responds when LLM_PROVIDER=mock — this endpoint must never
 * be reachable in production. The mock provider is itself a load-test-only
 * configuration, so the gate is sufficient.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (process.env.LLM_PROVIDER !== "mock") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  let email: string, password: string;
  try {
    const body = await request.json();
    email = body.email;
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email/password" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user_id: data.user?.id,
  });
}
