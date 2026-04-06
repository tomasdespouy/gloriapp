import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit";
import crypto from "crypto";

interface CsvRow {
  nombre: string;
  email: string;
  rol: string;
  asignatura: string;
  seccion: string;
}

interface RowError {
  row: number;
  email: string;
  error: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0].toLowerCase().trim();
  const headers = headerLine.split(/[,;\t]+/).map((h) => h.trim().replace(/^"|"$/g, ""));

  const nameIdx = headers.findIndex((h) => h === "nombre" || h === "name" || h === "full_name");
  const emailIdx = headers.findIndex((h) => h === "email" || h === "correo");
  const rolIdx = headers.findIndex((h) => h === "rol" || h === "role");
  const asignaturaIdx = headers.findIndex((h) => h === "asignatura" || h === "course" || h === "curso");
  const seccionIdx = headers.findIndex((h) => h === "seccion" || h === "sección" || h === "section");

  if (emailIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]+/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;

    rows.push({
      nombre: nameIdx >= 0 ? parts[nameIdx] || "" : "",
      email: parts[emailIdx] || "",
      rol: rolIdx >= 0 ? parts[rolIdx] || "" : "",
      asignatura: asignaturaIdx >= 0 ? parts[asignaturaIdx] || "" : "",
      seccion: seccionIdx >= 0 ? parts[seccionIdx] || "" : "",
    });
  }
  return rows;
}

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, establishment_id")
    .eq("id", user.id)
    .single();

  const callerRole = profile?.role;
  if (!callerRole || !["admin", "superadmin"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos para importar usuarios" }, { status: 403 });
  }

  // Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No se proporcionó archivo CSV" }, { status: 400 });
  }

  const csvText = await file.text();
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "El archivo CSV está vacío o no tiene el formato correcto. Columnas requeridas: nombre, email" },
      { status: 400 }
    );
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: "Máximo 500 usuarios por importación" }, { status: 400 });
  }

  const validRoles = callerRole === "superadmin"
    ? ["student", "instructor", "admin"]
    : ["student", "instructor"];

  const admin = createAdminClient();

  // Resolve establishment scope.
  // Admin: use first establishment from admin_establishments (for now, bulk import
  // does not support multiple destinations per import). If no assignment, error.
  // Superadmin: use profile.establishment_id (their default), or null.
  let establishmentId: string | undefined;
  if (callerRole === "admin") {
    const { data: assignments } = await supabase
      .from("admin_establishments")
      .select("establishment_id")
      .eq("admin_id", user.id);
    const allowedIds = (assignments || []).map((a) => a.establishment_id);
    if (allowedIds.length === 0) {
      return NextResponse.json(
        { error: "No tienes establecimientos asignados" },
        { status: 403 }
      );
    }
    establishmentId = allowedIds[0];
  } else {
    establishmentId = profile?.establishment_id || undefined;
  }

  const coursesMap: Record<string, string> = {}; // name -> id
  const sectionsMap: Record<string, string> = {}; // "courseId:sectionName" -> id

  if (establishmentId) {
    const { data: courses } = await admin
      .from("courses")
      .select("id, name")
      .eq("establishment_id", establishmentId);

    if (courses) {
      for (const c of courses) {
        coursesMap[c.name.toLowerCase().trim()] = c.id;
      }

      // Fetch sections for those courses
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length > 0) {
        const { data: sections } = await admin
          .from("sections")
          .select("id, name, course_id")
          .in("course_id", courseIds);

        if (sections) {
          for (const s of sections) {
            sectionsMap[`${s.course_id}:${s.name.toLowerCase().trim()}`] = s.id;
          }
        }
      }
    }
  }

  const errors: RowError[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, and we're 1-indexed

    // Validate email
    const email = row.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      errors.push({ row: rowNum, email: email || "(vacío)", error: "Email inválido" });
      continue;
    }

    // Validate name
    const nombre = row.nombre.trim();
    if (!nombre) {
      errors.push({ row: rowNum, email, error: "Nombre vacío" });
      continue;
    }

    // Validate role
    let role = row.rol.trim().toLowerCase();
    if (!role) role = "student";
    if (!validRoles.includes(role)) {
      errors.push({
        row: rowNum,
        email,
        error: `Rol inválido: "${row.rol}". Valores permitidos: ${validRoles.join(", ")}`,
      });
      continue;
    }

    // Look up course
    let courseId: string | null = null;
    const asignatura = row.asignatura.trim().toLowerCase();
    if (asignatura && coursesMap[asignatura]) {
      courseId = coursesMap[asignatura];
    }

    // Look up section
    let sectionId: string | null = null;
    const seccion = row.seccion.trim().toLowerCase();
    if (seccion && courseId && sectionsMap[`${courseId}:${seccion}`]) {
      sectionId = sectionsMap[`${courseId}:${seccion}`];
    }

    // Create auth user
    const tempPassword = crypto.randomUUID().slice(0, 12);

    try {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: nombre,
          role,
          establishment_id: establishmentId || undefined,
        },
      });

      if (createError) {
        errors.push({ row: rowNum, email, error: createError.message });
        continue;
      }

      // Update profile with course/section if found
      if (newUser?.user?.id) {
        const updates: Record<string, unknown> = {};
        if (courseId) updates.course_id = courseId;
        if (sectionId) updates.section_id = sectionId;
        if (Object.keys(updates).length > 0) {
          await admin.from("profiles").update(updates).eq("id", newUser.user.id);
        }
      }

      created++;
    } catch (e) {
      errors.push({
        row: rowNum,
        email,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  // Audit log
  await logAdminAction({
    adminId: user.id,
    action: "bulk_import_csv",
    entityType: "user",
    details: {
      total: rows.length,
      created,
      errors: errors.length,
      fileName: file.name,
    },
  });

  return NextResponse.json({
    total: rows.length,
    created,
    errors,
  });
}
