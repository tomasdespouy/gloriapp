"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ToggleLeft, ToggleRight, ChevronRight, Building2, Globe, Pencil, Trash2, X } from "lucide-react";

type Institution = {
  id: string;
  name: string;
  slug: string;
  country: string;
  logo_url: string | null;
  website_url: string | null;
  contact_name: string;
  contact_email: string;
  is_active: boolean;
  totalUsers: number;
  students: number;
  instructors: number;
  admins: number;
};

export default function InstitutionList({
  institutions,
  isSuperadmin,
}: {
  institutions: Institution[];
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleActive = async (id: string, currentActive: boolean) => {
    setToggling(id);
    await fetch(`/api/admin/establishments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    setToggling(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/establishments/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      }
    } catch { /* ignore */ }
    setDeleting(false);
  };

  if (institutions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No hay instituciones registradas</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-stagger">
        {institutions.map((inst) => {
          const isLoading = toggling === inst.id;

          return (
            <div
              key={inst.id}
              className={`bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all hover:shadow-md ${
                isLoading ? "opacity-50" : ""
              } ${!inst.is_active ? "opacity-70" : ""}`}
            >
              {/* Header */}
              <div className="flex items-center gap-4 p-5 border-b border-gray-100">
                {inst.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo_url} alt={inst.name} className="w-12 h-12 rounded-xl object-contain bg-sidebar p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-sidebar/10 flex items-center justify-center">
                    <Building2 size={22} className="text-sidebar" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{inst.name}</h3>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                      inst.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                    }`}>
                      {inst.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{inst.country} &middot; {inst.slug}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {isSuperadmin && (
                    <>
                      <button
                        onClick={() => toggleActive(inst.id, inst.is_active)}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title={inst.is_active ? "Desactivar institución" : "Activar institución"}
                      >
                        {inst.is_active ? (
                          <ToggleRight size={24} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={24} className="text-gray-300" />
                        )}
                      </button>
                      <Link
                        href={`/admin/establecimientos/${inst.id}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-sidebar"
                        title="Editar institución"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(inst)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                        title="Eliminar institución"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  <Link href={`/admin/establecimientos/${inst.id}`} className="p-1 text-gray-300 hover:text-sidebar">
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 divide-x divide-gray-100">
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{inst.totalUsers}</p>
                  <p className="text-[10px] text-gray-400">Inscritos</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-blue-600">{inst.students}</p>
                  <p className="text-[10px] text-gray-400">Alumnos</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{inst.instructors}</p>
                  <p className="text-[10px] text-gray-400">Docentes</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-purple-600">{inst.admins}</p>
                  <p className="text-[10px] text-gray-400">Admins</p>
                </div>
              </div>

              {/* Contact */}
              <div className="px-5 py-3 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
                <span>Contacto: {inst.contact_name} ({inst.contact_email})</span>
                {inst.website_url && (
                  <a href={inst.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sidebar hover:underline">
                    <Globe size={12} /> Web
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Eliminar institución</h3>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              ¿Estás seguro de que deseas eliminar <strong>{deleteTarget.name}</strong>?
            </p>

            {deleteTarget.totalUsers > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-700">
                  Esta institución tiene <strong>{deleteTarget.totalUsers} usuarios</strong> asociados
                  ({deleteTarget.students} alumnos, {deleteTarget.instructors} docentes, {deleteTarget.admins} admins).
                  Estos usuarios perderán su asociación institucional.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
