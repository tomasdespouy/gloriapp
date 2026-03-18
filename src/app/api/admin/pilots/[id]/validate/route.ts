import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const rows: { email?: string; full_name?: string; role?: string }[] = body.rows || [];

  const errors: { row: number; field: string; message: string }[] = [];
  const validRows: { email: string; full_name: string; role: string }[] = [];
  const seenEmails = new Set<string>();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validRoles = ["student", "instructor"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Check email
    if (!row.email || !row.email.trim()) {
      errors.push({ row: rowNum, field: "email", message: "Email es requerido" });
      continue;
    }

    const email = row.email.trim().toLowerCase();

    if (!emailRegex.test(email)) {
      errors.push({ row: rowNum, field: "email", message: `Email inválido: ${email}` });
      continue;
    }

    if (seenEmails.has(email)) {
      errors.push({ row: rowNum, field: "email", message: `Email duplicado: ${email}` });
      continue;
    }
    seenEmails.add(email);

    // Check full_name
    if (!row.full_name || !row.full_name.trim()) {
      errors.push({ row: rowNum, field: "full_name", message: "Nombre completo es requerido" });
      continue;
    }

    // Check role
    const role = (row.role || "student").toLowerCase().trim();
    if (!validRoles.includes(role)) {
      errors.push({ row: rowNum, field: "role", message: `Rol inválido: ${row.role}. Usar: student o instructor` });
      continue;
    }

    validRows.push({
      email,
      full_name: row.full_name.trim(),
      role,
    });
  }

  // Check for existing users in the database
  if (validRows.length > 0) {
    const emails = validRows.map((r) => r.email);
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("email", emails);

    if (existingProfiles && existingProfiles.length > 0) {
      const existingEmails = new Set(existingProfiles.map((p) => p.email?.toLowerCase()));
      for (const row of validRows) {
        if (existingEmails.has(row.email)) {
          errors.push({
            row: rows.findIndex((r) => r.email?.trim().toLowerCase() === row.email) + 1,
            field: "email",
            message: `Ya existe un usuario con email: ${row.email}`,
          });
        }
      }
    }
  }

  // Update pilot status if all valid
  if (errors.length === 0 && validRows.length > 0) {
    await supabase
      .from("pilots")
      .update({ status: "validado", updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({
    valid_count: validRows.length,
    error_count: errors.length,
    total: rows.length,
    errors,
    valid_rows: validRows,
  });
}
