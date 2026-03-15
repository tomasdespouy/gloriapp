import { getAdminContext } from "@/lib/admin-helpers";
import { redirect } from "next/navigation";
import EstablishmentForm from "../EstablishmentForm";
import { Building2 } from "lucide-react";
import Link from "next/link";

export default async function NuevoEstablecimientoPage() {
  const ctx = await getAdminContext();

  if (!ctx.isSuperadmin) redirect("/admin/establecimientos");

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href="/admin/establecimientos" className="hover:text-sidebar transition-colors">
            Instituciones
          </Link>
          <span>/</span>
          <span className="text-gray-700">Nuevo</span>
        </div>
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Nueva institución</h1>
        </div>
      </header>

      <div className="px-8 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
          <EstablishmentForm />
        </div>
      </div>
    </div>
  );
}
