"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ToggleLeft, ToggleRight, Pencil, Eye, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Patient {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  quote: string;
  presenting_problem: string;
  difficulty_level: string;
  country: string[] | string | null;
  country_origin: string | null;
  country_residence: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const difficultyLabels: Record<string, { label: string; color: string; order: number }> = {
  beginner: { label: "Principiante", color: "bg-green-100 text-green-700", order: 0 },
  intermediate: { label: "Intermedio", color: "bg-yellow-100 text-yellow-700", order: 1 },
  advanced: { label: "Avanzado", color: "bg-red-100 text-red-700", order: 2 },
};

type SortKey = "name" | "difficulty" | "country" | "status" | "created";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronDown size={12} className="text-gray-300 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp size={12} className="text-sidebar ml-1 inline" />
    : <ChevronDown size={12} className="text-sidebar ml-1 inline" />;
}

export default function PatientTable({ patients, canEdit = false }: { patients: Patient[]; canEdit?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [countryFilter, setCountryFilter] = useState<string>("");

  // Build country options with counts from the "country" (visible para) array
  const countryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of patients) {
      const countries = Array.isArray(p.country) ? p.country : p.country ? [p.country] : [];
      for (const c of countries) {
        map[c] = (map[c] || 0) + 1;
      }
    }
    return map;
  }, [patients]);

  const countryOptions = useMemo(() => {
    return Object.entries(countryCountMap)
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([country, count]) => ({ country, count }));
  }, [countryCountMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Filter by country (visible para) array, then sort
  const filtered = useMemo(() => {
    if (!countryFilter) return patients;
    return patients.filter((p) => {
      const countries = Array.isArray(p.country) ? p.country : p.country ? [p.country] : [];
      return countries.includes(countryFilter);
    });
  }, [patients, countryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * (a.name || "").localeCompare(b.name || "", "es");
        case "difficulty":
          return dir * ((difficultyLabels[a.difficulty_level]?.order ?? 0) - (difficultyLabels[b.difficulty_level]?.order ?? 0));
        case "country": {
          const ca = a.country_origin || (Array.isArray(a.country) ? a.country[0] : a.country) || "";
          const cb = b.country_origin || (Array.isArray(b.country) ? b.country[0] : b.country) || "";
          return dir * ca.localeCompare(cb, "es");
        }
        case "status":
          return dir * (Number(a.is_active) - Number(b.is_active));
        case "created":
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  async function toggleActive(id: string, currentActive: boolean) {
    setLoading(id);
    await fetch(`/api/patients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    setLoading(null);
    router.refresh();
  }

  async function deletePatient(id: string) {
    setLoading(id);
    await fetch(`/api/patients/${id}`, { method: "DELETE" });
    setLoading(null);
    setDeleteConfirm(null);
    router.refresh();
  }

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <p className="text-gray-500">No hay pacientes creados aún.</p>
      </div>
    );
  }

  const patientToDelete = patients.find((p) => p.id === deleteConfirm);

  const thClass = "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 cursor-pointer select-none hover:text-gray-700 transition-colors";

  return (
    <>
      {/* Country filter */}
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="country-filter" className="text-sm text-gray-500">Filtrar por país (visible para):</label>
        <select
          id="country-filter"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4A55A2]/20 focus:border-[#4A55A2]"
        >
          <option value="">Todos ({patients.length})</option>
          {countryOptions.map(({ country, count }) => (
            <option key={country} value={country}>
              {country} ({count})
            </option>
          ))}
        </select>
        {countryFilter && (
          <span className="text-xs text-gray-400">
            {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className={thClass} onClick={() => handleSort("name")}>
                Paciente <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("difficulty")}>
                Dificultad <SortIcon col="difficulty" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("country")}>
                País <SortIcon col="country" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("status")}>
                Estado <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("created")}>
                Creado <SortIcon col="created" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((p) => {
              const diff = difficultyLabels[p.difficulty_level] || difficultyLabels.beginner;
              const isLoading = loading === p.id;
              const slug = p.name
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, "-");

              return (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isLoading ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${slug}.png?v=${new Date(p.updated_at || p.created_at).getTime()}`}
                        alt={p.name}
                        className="w-9 h-9 rounded-full object-cover bg-gray-100"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = `/patients/${slug}.png`;
                          } else {
                            img.style.display = "none";
                          }
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          {p.age ? `${p.age} años` : ""}{p.occupation ? `, ${p.occupation}` : ""}
                        </p>
                        {p.presenting_problem && (
                          <p className="text-[11px] text-gray-400 truncate max-w-[280px] mt-0.5">
                            {p.presenting_problem}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diff.color}`}>
                      {diff.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      {(p.country_origin || p.country_residence) && (
                        <p className="text-[11px] text-gray-600">
                          {p.country_origin && <span>Origen: {p.country_origin}</span>}
                          {p.country_origin && p.country_residence && p.country_origin !== p.country_residence && " / "}
                          {p.country_residence && p.country_origin !== p.country_residence && <span>Reside: {p.country_residence}</span>}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        Visible: {Array.isArray(p.country) ? p.country.join(", ") : p.country || "—"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canEdit ? (
                      <button
                        onClick={() => toggleActive(p.id, p.is_active)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        {p.is_active ? (
                          <>
                            <ToggleRight size={20} className="text-green-600" />
                            <span className="text-green-700 text-xs font-medium">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={20} className="text-gray-400" />
                            <span className="text-gray-500 text-xs">Inactivo</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${p.is_active ? "text-green-700" : "text-gray-400"}`}>
                        {p.is_active ? "Activo" : "Inactivo"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/perfiles/${p.id}`}
                        className="text-gray-400 hover:text-sidebar transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                        title="Ver detalle"
                      >
                        <Eye size={15} />
                      </Link>
                      {canEdit && (
                        <>
                          <Link
                            href={`/perfiles/${p.id}/editar`}
                            className="text-gray-400 hover:text-sidebar transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && patientToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">¿Eliminar paciente?</h3>
            </div>
            <p className="text-sm text-gray-600">
              Se eliminará permanentemente a <strong>{patientToDelete.name}</strong> y todas sus conversaciones asociadas. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => deletePatient(deleteConfirm)}
                className="end-session-btn flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Sí, eliminar
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
