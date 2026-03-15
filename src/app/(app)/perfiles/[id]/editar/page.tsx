import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PatientEditForm from "./PatientEditForm";

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin" && profile?.role !== "superadmin") {
    redirect("/perfiles");
  }

  const admin = createAdminClient();
  const { data: patient } = await admin
    .from("ai_patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) redirect("/perfiles");

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <Link href={`/perfiles/${id}`} className="inline-flex items-center gap-1.5 text-xs text-sidebar hover:underline mb-4">
          <ArrowLeft size={14} /> Volver al detalle
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar paciente</h1>
        <p className="text-sm text-gray-500 mb-6">{patient.name}</p>

        <PatientEditForm patient={patient} />
      </div>
    </div>
  );
}
