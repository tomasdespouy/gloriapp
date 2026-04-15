import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH profile.a11y_prefs for the authenticated user. Accepts only
// the known keys (fontSize, contrast); silently ignores anything else.

const VALID_FONT = new Set(["m", "l", "xl"]);
const VALID_CONTRAST = new Set(["default", "high"]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { fontSize?: unknown; contrast?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const prefs: Record<string, string> = {};
  if (typeof body.fontSize === "string" && VALID_FONT.has(body.fontSize)) {
    prefs.fontSize = body.fontSize;
  }
  if (typeof body.contrast === "string" && VALID_CONTRAST.has(body.contrast)) {
    prefs.contrast = body.contrast;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ a11y_prefs: prefs })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prefs });
}
