"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, Search, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Trash2, RotateCcw, Pencil,
} from "lucide-react";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_disabled: boolean;
  establishment_id: string | null;
  course_id: string | null;
  section_id: string | null;
  establishmentName: string;
  courseName: string;
  sectionName: string;
  sessionCount: number;
  lastActivity: string | null;
  created_at: string;
};

type Props = {
  users: User[];
  establishments: { id: string; name: string }[];
  isSuperadmin: boolean;
};

type SortKey = "full_name" | "email" | "role" | "establishmentName" | "courseName" | "sectionName" | "sessionCount";
type SortDir = "asc" | "desc";

export default function UsuariosClient({ users, establishments, isSuperadmin }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [estFilter, setEstFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = users
    .filter((u) => {
      const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchEst = !estFilter || u.establishment_id === estFilter;
      return matchSearch && matchRole && matchEst;
    })
    .sort((a, b) => {
      const av = (a[sortKey] ?? "") as string | number;
      const bv = (b[sortKey] ?? "") as string | number;
      const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleActive = async (userId: string, currentlyDisabled: boolean) => {
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_disabled: !currentlyDisabled }),
    });
    setActionLoading(null);
    router.refresh();
  };

  const resetUserData = async (userId: string) => {
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}/reset`, { method: "POST" });
    setActionLoading(null);
    setResetConfirm(null);
    router.refresh();
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setActionLoading(null);
    setDeleteConfirm(null);
    router.refresh();
  };

  const SortHeader = ({ label, sortKeyName, align = "left" }: { label: string; sortKeyName: SortKey; align?: string }) => (
    <th
      className={`text-${align} text-xs font-semibold text-gray-500 px-4 py-3 cursor-pointer hover:text-sidebar hover:bg-gray-50 transition-colors select-none`}
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyName ? (
          sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronDown size={10} className="opacity-30" />
        )}
      </span>
    </th>
  );

  const userToDelete = users.find((u) => u.id === deleteConfirm);

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-8 py-5">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <span className="text-sm text-gray-400 ml-1">({users.length})</span>
        </div>
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Crear usuario
        </button>
      </header>

      <div className="px-8 pb-8 space-y-4">
        {showCreateForm && <CreateUserForm establishments={establishments} isSuperadmin={isSuperadmin} onClose={() => setShowCreateForm(false)} />}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm shadow-sm" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm">
            <option value="">Todos los roles</option>
            <option value="student">Alumno</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
            {isSuperadmin && <option value="superadmin">Superadmin</option>}
          </select>
          <select value={estFilter} onChange={(e) => setEstFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm">
            <option value="">Todas las instituciones</option>
            {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortHeader label="Nombre" sortKeyName="full_name" />
                  <SortHeader label="Email" sortKeyName="email" />
                  <SortHeader label="Rol" sortKeyName="role" align="center" />
                  <SortHeader label="Institución" sortKeyName="establishmentName" />
                  <SortHeader label="Asignatura" sortKeyName="courseName" />
                  <SortHeader label="Sección" sortKeyName="sectionName" />
                  <SortHeader label="Sesiones" sortKeyName="sessionCount" align="center" />
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Estado</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Acciones</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isLoading = actionLoading === u.id;
                  const isActive = !u.is_disabled;

                  return (
                    <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isLoading ? "opacity-50" : ""} ${!isActive ? "bg-gray-50 opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{u.full_name || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{u.establishmentName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{u.courseName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{u.sectionName}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{u.sessionCount}</td>
                      {/* Toggle active */}
                      <td className="px-4 py-3 text-center">
                        {u.role === "superadmin" ? (
                          <span className="text-[10px] text-gray-300">—</span>
                        ) : isSuperadmin ? (
                          <button onClick={() => setToggleConfirm(u.id)} disabled={isLoading}
                            className="action-btn action-btn-green"
                            title={isActive ? "Desactivar usuario" : "Activar usuario"}>
                            {isActive
                              ? <ToggleRight size={22} className="text-green-500" />
                              : <ToggleLeft size={22} className="text-gray-300" />
                            }
                          </button>
                        ) : (
                          <span className={`text-[10px] font-medium ${isActive ? "text-green-600" : "text-gray-400"}`}>
                            {isActive ? "Activo" : "Inactivo"}
                          </span>
                        )}
                      </td>
                      {/* Actions: reset + delete */}
                      <td className="px-4 py-3">
                        {isSuperadmin && u.role !== "superadmin" && (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setResetConfirm(u.id)} disabled={isLoading}
                              className="action-btn action-btn-amber text-gray-300"
                              title="Restaurar datos iniciales">
                              <RotateCcw size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm(u.id)} disabled={isLoading}
                              className="action-btn action-btn-red text-gray-300"
                              title="Eliminar cuenta">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* Edit */}
                      <td className="px-4 py-3">
                        {u.role !== "superadmin" ? (
                          <Link href={`/admin/usuarios/${u.id}`}
                            className="action-btn action-btn-sidebar flex items-center gap-1 text-xs text-sidebar font-medium">
                            <Pencil size={12} /> Editar
                          </Link>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-sm text-gray-400 py-8">Sin usuarios</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toggle active/inactive confirmation modal */}
      {toggleConfirm && (() => {
        const u = users.find((x) => x.id === toggleConfirm);
        if (!u) return null;
        const willDisable = !u.is_disabled;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setToggleConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${willDisable ? "bg-amber-50" : "bg-green-50"}`}>
                  {willDisable ? <ToggleLeft size={24} className="text-amber-500" /> : <ToggleRight size={24} className="text-green-500" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{willDisable ? "¿Desactivar usuario?" : "¿Activar usuario?"}</h3>
                  <p className="text-xs text-gray-400">{u.full_name || u.email}</p>
                </div>
              </div>

              <div className={`rounded-xl p-4 ${willDisable ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                {willDisable ? (
                  <>
                    <p className="text-sm text-amber-800 font-medium mb-1">Al desactivar este usuario:</p>
                    <ul className="space-y-1 text-sm text-amber-700">
                      <li className="flex items-start gap-2"><span>•</span> No podrá iniciar sesión en la plataforma</li>
                      <li className="flex items-start gap-2"><span>•</span> Sus datos y progreso se mantendrán intactos</li>
                      <li className="flex items-start gap-2"><span>•</span> Podrás reactivarlo en cualquier momento</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-green-800 font-medium mb-1">Al activar este usuario:</p>
                    <ul className="space-y-1 text-sm text-green-700">
                      <li className="flex items-start gap-2"><span>•</span> Podrá volver a iniciar sesión</li>
                      <li className="flex items-start gap-2"><span>•</span> Recuperará acceso a todo su progreso</li>
                    </ul>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { toggleActive(toggleConfirm, u.is_disabled); setToggleConfirm(null); }}
                  disabled={actionLoading === toggleConfirm}
                  className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold ${willDisable ? "bg-amber-500" : "bg-green-500"}`}>
                  {actionLoading === toggleConfirm ? "Procesando..." : willDisable ? "Sí, desactivar" : "Sí, activar"}
                </button>
                <button onClick={() => setToggleConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reset confirmation modal */}
      {resetConfirm && (() => {
        const u = users.find((x) => x.id === resetConfirm);
        if (!u) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setResetConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <RotateCcw size={24} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">¿Restaurar datos iniciales?</h3>
                  <p className="text-xs text-gray-400">{u.full_name || u.email}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">Esta acción eliminará permanentemente:</p>
                <ul className="space-y-1.5 text-sm text-amber-700">
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todas las sesiones y conversaciones con pacientes</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todo el progreso (XP, nivel, racha)</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todos los logros desbloqueados</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todo el avance en aprendizaje</li>
                </ul>
                <p className="text-xs text-amber-600 font-semibold mt-3">El usuario volverá a Nivel 1 con 0 XP. Esta acción no se puede deshacer.</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => resetUserData(resetConfirm)} disabled={actionLoading === resetConfirm}
                  className="end-session-btn flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {actionLoading === resetConfirm ? "Restaurando..." : "Sí, restaurar datos"}
                </button>
                <button onClick={() => setResetConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation modal */}
      {deleteConfirm && (() => {
        const u = users.find((x) => x.id === deleteConfirm);
        if (!u) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">¿Eliminar cuenta de usuario?</h3>
                  <p className="text-xs text-gray-400">{u.full_name || u.email}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-800 font-medium mb-2">Esta acción eliminará permanentemente:</p>
                <ul className="space-y-1.5 text-sm text-red-700">
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> La cuenta del usuario y su acceso a la plataforma</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todas las sesiones, conversaciones y mensajes</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todo el progreso, logros y puntajes</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5">•</span> El perfil completo y sus datos personales</li>
                </ul>
                <p className="text-xs text-red-600 font-semibold mt-3">El usuario no podrá volver a acceder. Esta acción no se puede deshacer.</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => deleteUser(deleteConfirm)} disabled={actionLoading === deleteConfirm}
                  className="end-session-btn flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {actionLoading === deleteConfirm ? "Eliminando..." : "Sí, eliminar cuenta"}
                </button>
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    student: "bg-blue-50 text-blue-600",
    instructor: "bg-green-50 text-green-600",
    admin: "bg-purple-50 text-purple-600",
    superadmin: "bg-red-50 text-red-600",
  };
  const labels: Record<string, string> = {
    student: "Alumno",
    instructor: "Instructor",
    admin: "Admin",
    superadmin: "Superadmin",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors[role] || "bg-gray-100 text-gray-500"}`}>
      {labels[role] || role}
    </span>
  );
}

function CreateUserForm({ establishments, isSuperadmin, onClose }: { establishments: { id: string; name: string }[]; isSuperadmin: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"single" | "text" | "excel">("single");
  const [role, setRole] = useState("student");
  const [estId, setEstId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; failed: number; results?: { email: string; success: boolean; error?: string }[] } | null>(null);

  // Single mode
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  // Bulk text mode
  const [bulkText, setBulkText] = useState("");

  // Excel mode
  const [excelData, setExcelData] = useState<{ email: string; full_name: string }[]>([]);

  const roleOptions = isSuperadmin
    ? [{ v: "student", l: "Alumno" }, { v: "instructor", l: "Docente" }, { v: "admin", l: "Admin" }, { v: "superadmin", l: "Superadmin" }]
    : [{ v: "student", l: "Alumno" }, { v: "instructor", l: "Docente" }];

  const parseBulkText = (text: string) => {
    return text.split("\n").filter(l => l.trim()).map(line => {
      const parts = line.split(/[,;\t]+/).map(p => p.trim());
      const emailPart = parts.find(p => p.includes("@")) || "";
      const namePart = parts.find(p => !p.includes("@")) || emailPart.split("@")[0];
      return { email: emailPart, full_name: namePart };
    }).filter(r => r.email);
  };

  const handleExcelUpload = async (file: File) => {
    // Parse CSV/TSV (simple parsing for .csv)
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    const rows: { email: string; full_name: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t]+/).map(p => p.trim().replace(/^"|"$/g, ""));
      if (i === 0 && (parts[0].toLowerCase().includes("nombre") || parts[0].toLowerCase().includes("email") || parts[0].toLowerCase().includes("name"))) {
        continue; // Skip header row
      }
      const emailPart = parts.find(p => p.includes("@")) || "";
      const namePart = parts.find(p => !p.includes("@") && p.length > 1) || "";
      if (emailPart) rows.push({ email: emailPart, full_name: namePart });
    }
    setExcelData(rows);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    if (mode === "single") {
      if (!email || !fullName) { setError("Email y nombre requeridos"); setLoading(false); return; }
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role, establishment_id: estId || null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); setLoading(false); return; }
      setResult({ created: 1, failed: 0 });
    } else {
      const users = mode === "text" ? parseBulkText(bulkText) : excelData;
      if (users.length === 0) { setError("No se encontraron usuarios válidos"); setLoading(false); return; }

      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users, role, establishment_id: estId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error"); setLoading(false); return; }
      setResult(data);
    }
    setLoading(false);
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/20";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Crear usuarios</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className={`text-sm font-medium ${result.failed === 0 ? "text-green-600" : "text-amber-600"}`}>
            {result.created} creados{result.failed > 0 ? `, ${result.failed} con error` : ""}
          </div>
          {result.results?.filter(r => !r.success).map((r, i) => (
            <p key={i} className="text-xs text-red-500">{r.email}: {r.error}</p>
          ))}
          <button onClick={() => { onClose(); window.location.reload(); }} className="text-xs text-sidebar hover:underline">Cerrar y actualizar</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {[
              { key: "single" as const, label: "Individual" },
              { key: "text" as const, label: "Texto masivo" },
              { key: "excel" as const, label: "Archivo CSV" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setMode(key)}
                className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${mode === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Common fields: role + institution */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                {roleOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Institución</label>
              <select value={estId} onChange={(e) => setEstId(e.target.value)} className={inputClass}>
                <option value="">Sin asignar</option>
                {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          {/* Mode-specific content */}
          {mode === "single" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="usuario@email.com" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Nombre completo</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Juan Pérez" />
              </div>
            </div>
          )}

          {mode === "text" && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Un usuario por línea (nombre, email)
              </label>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6}
                className={`${inputClass} font-mono resize-y`}
                placeholder={"María López, maria@ejemplo.cl\nCarlos Ruiz, carlos@ejemplo.cl\nAna Torres, ana@ejemplo.cl"} />
              <p className="text-[10px] text-gray-400 mt-1">
                {parseBulkText(bulkText).length} usuarios detectados
              </p>
            </div>
          )}

          {mode === "excel" && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">
                Sube un archivo CSV o TSV con columnas nombre y email
              </label>
              <input type="file" accept=".csv,.tsv,.txt"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelUpload(f); }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sidebar/10 file:text-sidebar hover:file:bg-sidebar/20" />
              {excelData.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-green-600 font-medium">{excelData.length} usuarios detectados</p>
                  <div className="mt-1 max-h-32 overflow-y-auto text-[10px] text-gray-500 space-y-0.5">
                    {excelData.slice(0, 10).map((r, i) => (
                      <p key={i}>{r.full_name} — {r.email}</p>
                    ))}
                    {excelData.length > 10 && <p className="text-gray-400">...y {excelData.length - 10} más</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3">
            <button onClick={handleCreate} disabled={loading}
              className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? "Creando..." : mode === "single" ? "Crear usuario" : `Crear ${mode === "text" ? parseBulkText(bulkText).length : excelData.length} usuarios`}
            </button>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
