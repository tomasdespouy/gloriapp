import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Solo superadmin" }, { status: 403 }) };
  }

  return { supabase, user };
}

export async function GET() {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const { data, error } = await supabase
    .from("growth_drip_sequences")
    .select("*, growth_drip_steps(count), growth_enrollments(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const body = await request.json();
  const { name, description, steps } = body;

  if (!name) {
    return NextResponse.json({ error: "name es requerido" }, { status: 400 });
  }

  // Create sequence
  const { data: sequence, error } = await supabase
    .from("growth_drip_sequences")
    .insert({ name, description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create steps if provided
  if (steps?.length > 0) {
    const stepsToInsert = steps.map((step: { subject: string; html_body: string; delay_days: number }, i: number) => ({
      sequence_id: sequence.id,
      step_order: i + 1,
      delay_days: step.delay_days || 0,
      subject: step.subject,
      html_body: step.html_body,
    }));

    const { error: stepsError } = await supabase
      .from("growth_drip_steps")
      .insert(stepsToInsert);

    if (stepsError) return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  return NextResponse.json(sequence, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const body = await request.json();
  const { id, steps, enroll_contacts, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Handle enrollment
  if (enroll_contacts?.length > 0) {
    const enrollments = enroll_contacts.map((contactId: string) => ({
      contact_id: contactId,
      sequence_id: id,
      current_step: 0,
      status: "active",
      next_send_at: new Date().toISOString(),
    }));

    const { error: enrollError } = await supabase
      .from("growth_enrollments")
      .upsert(enrollments, { onConflict: "contact_id,sequence_id" });

    if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });
    return NextResponse.json({ success: true, enrolled: enroll_contacts.length });
  }

  const { data, error } = await supabase
    .from("growth_drip_sequences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace steps if provided
  if (steps) {
    await supabase.from("growth_drip_steps").delete().eq("sequence_id", id);

    if (steps.length > 0) {
      const stepsToInsert = steps.map((step: { subject: string; html_body: string; delay_days: number }, i: number) => ({
        sequence_id: id,
        step_order: i + 1,
        delay_days: step.delay_days || 0,
        subject: step.subject,
        html_body: step.html_body,
      }));

      await supabase.from("growth_drip_steps").insert(stepsToInsert);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireSuperadmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } };

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await supabase.from("growth_drip_sequences").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
