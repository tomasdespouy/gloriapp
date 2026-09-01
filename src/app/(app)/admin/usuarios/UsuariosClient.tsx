"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Plus, Search, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Trash2, RotateCcw, Pencil,
  ChevronLeft, ChevronRight,
  Upload, FileText, AlertCircle, CheckCircle,
  CheckSquare, X, Loader2, KeyRound, Download, CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import HelpTip from "@/components/HelpTip";
import { accessBlockDetail, accessBlockLabel, type AccessBlock } from "@/lib/access-status";
import ProgramarEnvioModal from "./ProgramarEnvioModal";
import EnviosProgramados from "./EnviosProgramados";

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
  credentials_sent_at: string | null;
  /** Por qué esta cuenta no puede entrar (o { kind: "none" }). */
  accessBlock: AccessBlock;
};

export type CourseOption = { id: string; name: string; establishment_id: string | null; is_active?: boolean };
export type SectionOption = { id: string; name: string; course_id: string | null; is_active?: boolean };

type Props = {
  users: User[];
  establishments: { id: string; name: string }[];
  courses: CourseOption[];
  sections: SectionOption[];
  isSuperadmin: boolean;
  totalCount: number;
  currentPage: number;
  perPage: number;
  initialSearch: string;
  initialRole: string;
  initialEst: string;
  initialCourse: string;
  initialSection: string;
  initialEstado: string;
};

type SortKey = "full_name" | "email" | "role" | "establishmentName" | "courseName" | "sectionName" | "sessionCount";
type SortDir = "asc" | "desc";

// Resultado por persona del envío masivo de credenciales (para el reporte).
type CredResult = { id: string; name: string; email: string; status: "sent" | "failed"; reason?: string };

export default function UsuariosClient({ users, establishments, courses, sections, isSuperadmin, totalCount, currentPage, perPage, initialSearch, initialRole, initialEst, initialCourse, initialSection, initialEstado }: Props) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [estFilter, setEstFilter] = useState(initialEst);
  const [courseFilter, setCourseFilter] = useState(initialCourse);
  const [sectionFilter, setSectionFilter] = useState(initialSection);
  const [estadoFilter, setEstadoFilter] = useState(initialEstado);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  // Al abrir la ficha de un usuario, arrastramos el filtro actual (en `from`)
  // para que el "volver" regrese a la lista filtrada.
  const filterSuffix = searchParamsHook.toString() ? `?from=${encodeURIComponent(searchParamsHook.toString())}` : "";

  // Navigate with all current filters preserved
  const navigate = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParamsHook.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    // Reset to page 1 when filters change (unless explicitly setting page)
    if (!("page" in overrides)) params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(`/admin/usuarios${qs ? `?${qs}` : ""}`);
    });
  }, [router, searchParamsHook]);

  const goToPage = useCallback((page: number) => {
    navigate({ page: page <= 1 ? "" : String(page) });
  }, [navigate]);

  // Debounced server-side search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ q: value });
    }, 350);
  }, [navigate]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<string | null>(null);
  const [passwordResetConfirm, setPasswordResetConfirm] = useState<string | null>(null);

  // Bulk selection state
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkResetConfirm, setBulkResetConfirm] = useState(false);
  // Bulk send credentials (resets temp password + emails each selected user).
  const [bulkSendCredsConfirm, setBulkSendCredsConfirm] = useState(false);
  // Envío programado: corre en el servidor, sobrevive a cerrar el navegador.
  const [programarOpen, setProgramarOpen] = useState(false);
  const [enviosRefresh, setEnviosRefresh] = useState(0);
  const [credsReport, setCredsReport] = useState<CredResult[] | null>(null);
  // Bulk hard delete — requires typing a confirmation word.
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleteText, setBulkDeleteText] = useState("");
  // Bulk reassign asignatura/sección (one institution at a time).
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [reassignEstId, setReassignEstId] = useState("");
  const [reassignCourseId, setReassignCourseId] = useState("");
  const [reassignSectionId, setReassignSectionId] = useState("");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Data already filtered server-side, only sort client-side
  const filtered = [...users].sort((a, b) => {
    const av = (a[sortKey] ?? "") as string | number;
    const bv = (b[sortKey] ?? "") as string | number;
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Gestionar = editar perfil / activar-desactivar / reasignar / credenciales.
  // Un admin solo puede sobre estudiantes/docentes de su alcance (la lista ya
  // viene scoped); nunca sobre otros admins ni superadmins. El superadmin
  // gestiona a todos salvo superadmins.
  const canManage = (u: User) => {
    if (u.role === "superadmin") return false;
    if (isSuperadmin) return true;
    return u.role === "student" || u.role === "instructor";
  };

  // Bulk selection computed values
  const selectableIds = filtered.filter(canManage).map((u) => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => bulkSelectedIds.has(id));
  const someSelected = bulkSelectedIds.size > 0;

  const bulkToggleAll = () => {
    if (allSelected) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(selectableIds));
    }
  };

  const bulkToggleOne = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetActive = async (disable: boolean) => {
    const ids = Array.from(bulkSelectedIds);
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });
    let successes = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      try {
        const res = await fetch(`/api/admin/users/${ids[i]}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_disabled: disable }),
        });
        if (!res.ok) throw new Error();
        successes++;
      } catch {
        errors++;
      }
    }

    setBulkProcessing(false);
    setBulkProgress(null);
    setBulkSelectedIds(new Set());

    if (errors === 0) {
      toast.success(`${successes} usuarios ${disable ? "desactivados" : "activados"} exitosamente`);
    } else {
      toast.warning(`${successes} exitosos, ${errors} con errores`);
    }
    router.refresh();
  };

  const bulkResetData = async () => {
    const ids = Array.from(bulkSelectedIds);
    setBulkResetConfirm(false);
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });
    let successes = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      try {
        const res = await fetch(`/api/admin/users/${ids[i]}/reset`, { method: "POST" });
        if (!res.ok) throw new Error();
        successes++;
      } catch {
        errors++;
      }
    }

    setBulkProcessing(false);
    setBulkProgress(null);
    setBulkSelectedIds(new Set());

    if (errors === 0) {
      toast.success(`Datos restaurados para ${successes} usuarios`);
    } else {
      toast.warning(`${successes} exitosos, ${errors} con errores`);
    }
    router.refresh();
  };

  // Envío de credenciales: por cada id, resetea la clave temporal y manda el
  // correo (endpoint per-usuario). El éxito se mide por `emailSent` real, no
  // por HTTP 200 — un 200 con emailSent:false (p. ej. Resend cayó) cuenta como
  // fallido. Devuelve el detalle por persona para el reporte.
  const sendCredentialsToIds = async (ids: string[]): Promise<CredResult[]> => {
    const out: CredResult[] = [];
    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      const u = users.find((x) => x.id === ids[i]);
      const name = u?.full_name || "—";
      const email = u?.email || ids[i];
      try {
        const res = await fetch(`/api/admin/users/${ids[i]}/reset-password`, { method: "POST" });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.emailSent) {
          out.push({ id: ids[i], name, email, status: "sent" });
        } else {
          const reason = data?.emailError || data?.error || `HTTP ${res.status}`;
          out.push({ id: ids[i], name, email, status: "failed", reason });
        }
      } catch {
        out.push({ id: ids[i], name, email, status: "failed", reason: "Error de red" });
      }
    }
    return out;
  };

  const bulkSendCredentials = async () => {
    const ids = Array.from(bulkSelectedIds);
    setBulkSendCredsConfirm(false);
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });
    const results = await sendCredentialsToIds(ids);
    setBulkProcessing(false);
    setBulkProgress(null);
    setBulkSelectedIds(new Set());
    setCredsReport(results);
    const ok = results.filter((r) => r.status === "sent").length;
    const bad = results.length - ok;
    if (bad === 0) toast.success(`Credenciales enviadas a ${ok} usuario(s)`);
    else toast.warning(`${ok} enviada(s), ${bad} con error`);
    router.refresh();
  };

  const retryFailedCredentials = async () => {
    if (!credsReport) return;
    const failedIds = credsReport.filter((r) => r.status === "failed").map((r) => r.id);
    if (failedIds.length === 0) return;
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: failedIds.length });
    const retry = await sendCredentialsToIds(failedIds);
    setBulkProcessing(false);
    setBulkProgress(null);
    const retryMap = new Map(retry.map((r) => [r.id, r]));
    setCredsReport(credsReport.map((r) => retryMap.get(r.id) || r));
    router.refresh();
  };

  const downloadCredsReport = () => {
    if (!credsReport) return;
    const header = ["Nombre", "Email", "Estado", "Motivo"];
    const rows = credsReport.map((r) => [r.name, r.email, r.status === "sent" ? "Enviado" : "Fallido", r.reason || ""]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bulk HARD delete — irreversible. Loops DELETE per user.
  const bulkDelete = async () => {
    const ids = Array.from(bulkSelectedIds);
    setBulkDeleteConfirm(false);
    setBulkDeleteText("");
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });
    let successes = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      try {
        const res = await fetch(`/api/admin/users/${ids[i]}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        successes++;
      } catch {
        errors++;
      }
    }

    setBulkProcessing(false);
    setBulkProgress(null);
    setBulkSelectedIds(new Set());
    if (errors === 0) toast.success(`${successes} usuarios eliminados`);
    else toast.warning(`${successes} eliminados, ${errors} con errores`);
    router.refresh();
  };

  // Bulk reassign establishment + asignatura + sección. Applies the chosen
  // institution/course/section to every selected user (one institution at a
  // time), keeping establishment_id consistent with the course.
  const bulkReassign = async () => {
    const ids = Array.from(bulkSelectedIds);
    setBulkReassignOpen(false);
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: ids.length });
    let successes = 0;
    let errors = 0;

    const payload = {
      establishment_id: reassignEstId,
      course_id: reassignCourseId || null,
      section_id: reassignSectionId || null,
    };

    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length });
      try {
        const res = await fetch(`/api/admin/users/${ids[i]}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        successes++;
      } catch {
        errors++;
      }
    }

    setBulkProcessing(false);
    setBulkProgress(null);
    setBulkSelectedIds(new Set());
    setReassignEstId(""); setReassignCourseId(""); setReassignSectionId("");
    if (errors === 0) toast.success(`${successes} usuarios reasignados`);
    else toast.warning(`${successes} reasignados, ${errors} con errores`);
    router.refresh();
  };

  const toggleActive = async (userId: string, currentlyDisabled: boolean) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_disabled: !currentlyDisabled }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success(currentlyDisabled ? "Usuario activado" : "Usuario desactivado");
      router.refresh();
    } catch {
      toast.error("Error al cambiar el estado del usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const resetUserData = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Datos del usuario restaurados");
      setResetConfirm(null);
      router.refresh();
    } catch {
      toast.error("Error al restaurar datos del usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Usuario eliminado");
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      toast.error("Error al eliminar el usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const resetPassword = async (userId: string) => {
    const target = users.find((x) => x.id === userId);
    const firstTime = target?.credentials_sent_at == null;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      if (!res.ok) throw new Error("Error del servidor");
      const data = await res.json();
      if (data.emailSent) {
        toast.success(firstTime ? "Credenciales enviadas" : "Contraseña restablecida y correo enviado");
      } else {
        toast.success(firstTime ? "Usuario creado (correo no configurado)" : "Contraseña restablecida (correo no configurado)");
      }
      setPasswordResetConfirm(null);
      router.refresh();
    } catch {
      toast.error(firstTime ? "Error al enviar credenciales" : "Error al restablecer la contraseña");
    } finally {
      setActionLoading(null);
    }
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

  // Superadmin can issue credentials for anyone except other superadmins.
  // Admin can issue credentials only for students/instructors within their scope
  // (the listing is already scoped, so no extra check is needed here).
  const canIssueCredentials = (u: User) => {
    if (u.role === "superadmin") return false;
    if (isSuperadmin) return true;
    return u.role === "student" || u.role === "instructor";
  };

  // Insignia del motivo por el que la cuenta no puede entrar. Rojo = la cuenta
  // está apagada; ámbar = la ventana del piloto la deja fuera; azul = solo
  // tiene que definir su clave al entrar (no es un bloqueo permanente).
  const AccessBlockBadge = ({ block }: { block: AccessBlock }) => {
    if (!block || block.kind === "none") return null;
    const tone =
      block.kind === "disabled"
        ? "text-red-700 bg-red-50 border-red-200"
        : block.kind === "pilot"
          ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-sky-700 bg-sky-50 border-sky-200";
    return (
      <span
        className={`inline-flex items-center text-[9px] font-semibold border rounded-full px-1.5 py-0.5 whitespace-nowrap ${tone}`}
        title={accessBlockDetail(block)}
      >
        {accessBlockLabel(block)}
      </span>
    );
  };

  const SinCredentialesBadge = () => (
    <span
      className="inline-flex items-center text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 whitespace-nowrap"
      title="Este usuario aún no ha recibido sus credenciales de acceso"
    >
      Sin credenciales
    </span>
  );

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center px-4 sm:px-8 py-5">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <span className="text-sm text-gray-400 ml-1">({totalCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCsvImport(!showCsvImport); setShowCreateForm(false); }}
            className="flex items-center gap-2 border border-sidebar text-sidebar px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar/5 transition-colors cursor-pointer">
            <Upload size={16} /> Importar CSV
          </button>
          <button onClick={() => { setShowCreateForm(!showCreateForm); setShowCsvImport(false); }}
            className="flex items-center gap-2 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors cursor-pointer">
            <Plus size={16} /> Crear usuario
          </button>
        </div>
      </header>

      <div className={`px-4 sm:px-8 pb-8 space-y-4 ${someSelected ? "pb-24" : ""}`}>
        <EnviosProgramados refreshKey={enviosRefresh} />
        {showCreateForm && <CreateUserForm establishments={establishments} courses={courses} sections={sections} isSuperadmin={isSuperadmin} onClose={() => setShowCreateForm(false)} />}

        {showCsvImport && <CsvImportSection onClose={() => setShowCsvImport(false)} />}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {isPending && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar animate-spin" />
            )}
            <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-lg text-sm shadow-sm" />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); navigate({ role: e.target.value }); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm hover:border-gray-300 cursor-pointer">
            <option value="">Todos los roles</option>
            <option value="student">Alumno</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
            {isSuperadmin && <option value="superadmin">Superadmin</option>}
          </select>
          <select value={estFilter} onChange={(e) => { setEstFilter(e.target.value); setCourseFilter(""); setSectionFilter(""); navigate({ est: e.target.value, course: "", section: "" }); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm hover:border-gray-300 cursor-pointer">
            <option value="">Todas las instituciones</option>
            {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setSectionFilter(""); navigate({ course: e.target.value, section: "" }); }}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm hover:border-gray-300 cursor-pointer">
            <option value="">Todas las asignaturas</option>
            {(estFilter ? courses.filter((c) => c.establishment_id === estFilter) : courses).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); navigate({ section: e.target.value }); }}
            disabled={!courseFilter}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm hover:border-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <option value="">Todas las secciones</option>
            {sections.filter((s) => s.course_id === courseFilter).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={estadoFilter} onChange={(e) => { setEstadoFilter(e.target.value); navigate({ estado: e.target.value }); }}
            title="Motivo por el que una cuenta no puede entrar a la plataforma"
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm shadow-sm hover:border-gray-300 cursor-pointer">
            <option value="">Cualquier estado de acceso</option>
            <option value="bloqueado">Solo los bloqueados</option>
            <option value="desactivado">Desactivados</option>
            <option value="piloto">Bloqueados por el piloto</option>
            <option value="clave">Con clave temporal pendiente</option>
          </select>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden space-y-3">
          {filtered.map((u) => {
            const isLoading = actionLoading === u.id;
            const isActive = !u.is_disabled;
            const isChecked = bulkSelectedIds.has(u.id);
            return (
              <div key={u.id} className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${isLoading ? "opacity-50" : ""} ${!isActive ? "opacity-60" : ""} ${isChecked ? "ring-2 ring-sidebar/30 border-sidebar/40" : ""}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2.5">
                    {canManage(u) && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => bulkToggleOne(u.id)}
                        disabled={bulkProcessing}
                        className="w-4 h-4 rounded border-gray-300 text-sidebar focus:ring-sidebar flex-shrink-0 mt-0.5"
                      />
                    )}
                    <p className="text-sm font-medium text-gray-900">{u.full_name || "\u2014"}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.credentials_sent_at === null && <SinCredentialesBadge />}
                  <AccessBlockBadge block={u.accessBlock} />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-3">
                  {u.establishmentName && <span>{u.establishmentName}</span>}
                  {u.establishmentName && (u.courseName || u.sectionName) && <span className="text-gray-300">{"\u00B7"}</span>}
                  {u.courseName && <span>{u.courseName}</span>}
                  {u.courseName && u.sectionName && <span className="text-gray-300">{"\u00B7"}</span>}
                  {u.sectionName && <span>{u.sectionName}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{u.sessionCount} {u.sessionCount === 1 ? "sesi\u00F3n" : "sesiones"}</span>
                  <div className="flex items-center gap-2">
                    {canManage(u) && (
                      <button onClick={() => setToggleConfirm(u.id)} disabled={isLoading}
                        className="action-btn action-btn-green"
                        title={isActive ? "Desactivar usuario" : "Activar usuario"}>
                        {isActive
                          ? <ToggleRight size={20} className="text-green-500" />
                          : <ToggleLeft size={20} className="text-gray-300" />
                        }
                      </button>
                    )}
                    {u.role !== "superadmin" && !canManage(u) && (
                      <span className={`text-[10px] font-medium ${isActive ? "text-green-600" : "text-gray-400"}`}>
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    )}
                    {canIssueCredentials(u) && (
                      <button onClick={() => setPasswordResetConfirm(u.id)} disabled={isLoading}
                        className="action-btn action-btn-sidebar text-gray-300"
                        title={u.credentials_sent_at ? "Reenviar credenciales" : "Enviar credenciales"}>
                        <KeyRound size={14} />
                      </button>
                    )}
                    {isSuperadmin && u.role !== "superadmin" && (
                      <>
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
                      </>
                    )}
                    {u.role !== "superadmin" && (
                      <Link href={`/admin/usuarios/${u.id}${filterSuffix}`}
                        className="action-btn action-btn-sidebar flex items-center gap-1 text-xs text-sidebar font-medium">
                        <Pencil size={12} /> Editar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-8">Sin usuarios</div>
          )}
        </div>

        {/* Desktop table */}
        <div className={`hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm relative transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={bulkToggleAll}
                      disabled={bulkProcessing || selectableIds.length === 0}
                      className="w-4 h-4 rounded border-gray-300 text-sidebar focus:ring-sidebar"
                      title={allSelected ? "Deseleccionar todos" : "Seleccionar todos en esta página"}
                    />
                  </th>
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
                  const isChecked = bulkSelectedIds.has(u.id);

                  return (
                    <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isLoading ? "opacity-50" : ""} ${!isActive ? "bg-gray-50 opacity-60" : ""} ${isChecked ? "bg-sidebar/5" : ""}`}>
                      <td className="px-4 py-3 w-10">
                        {canManage(u) ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => bulkToggleOne(u.id)}
                            disabled={bulkProcessing}
                            className="w-4 h-4 rounded border-gray-300 text-sidebar focus:ring-sidebar"
                          />
                        ) : (
                          <span />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{u.full_name || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-gray-500">{u.email}</p>
                          {u.credentials_sent_at === null && <SinCredentialesBadge />}
                          <AccessBlockBadge block={u.accessBlock} />
                        </div>
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
                        ) : canManage(u) ? (
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
                      {/* Actions: credentials + (superadmin-only) reset + delete */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canIssueCredentials(u) && (
                            <button onClick={() => setPasswordResetConfirm(u.id)} disabled={isLoading}
                              className="action-btn action-btn-sidebar text-gray-300"
                              title={u.credentials_sent_at ? "Reenviar credenciales" : "Enviar credenciales"}>
                              <KeyRound size={14} />
                            </button>
                          )}
                          {isSuperadmin && u.role !== "superadmin" && (
                            <>
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
                            </>
                          )}
                        </div>
                      </td>
                      {/* Edit */}
                      <td className="px-4 py-3">
                        {u.role !== "superadmin" ? (
                          <Link href={`/admin/usuarios/${u.id}${filterSuffix}`}
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
                    <td colSpan={11} className="text-center text-sm text-gray-400 py-8">Sin usuarios</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-500">
              {isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin text-sidebar" />
                  Cargando...
                </span>
              ) : (
                <>Mostrando {Math.min((currentPage - 1) * perPage + 1, totalCount)}&ndash;{Math.min(currentPage * perPage, totalCount)} de {totalCount} usuarios</>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300 active:bg-gray-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:active:scale-100 transition-all"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <span className="text-sm text-gray-600 px-2">
                P\u00e1gina {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300 active:bg-gray-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:active:scale-100 transition-all"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions bar — un admin ve solo las acciones que el servidor le
          autoriza sobre su alcance (activar/desactivar, reasignar, credenciales).
          Restablecer datos y Borrar siguen siendo superadmin-only en la API. */}
      {someSelected && (
        <div className="fixed bottom-0 left-0 right-0 md:left-[260px] bg-white border-t border-gray-200 shadow-lg p-4 z-40">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-sidebar/10 text-sidebar px-3 py-1.5 rounded-lg">
                <CheckSquare size={16} />
                <span className="text-sm font-semibold">{bulkSelectedIds.size} {bulkSelectedIds.size === 1 ? "usuario seleccionado" : "usuarios seleccionados"}</span>
              </div>
              <button
                onClick={() => setBulkSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X size={14} /> Deseleccionar
              </button>
            </div>

            {bulkProcessing ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin text-sidebar" />
                <span>Procesando {bulkProgress?.current ?? 0} de {bulkProgress?.total ?? 0}...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkSetActive(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer"
                >
                  <ToggleRight size={16} /> Activar seleccionados
                </button>
                <button
                  onClick={() => bulkSetActive(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <ToggleLeft size={16} /> Desactivar seleccionados
                </button>
                {isSuperadmin && (
                  <button
                    onClick={() => setBulkResetConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={16} /> Restablecer datos
                  </button>
                )}
                <button
                  onClick={() => {
                    // Con una sola institución en el alcance (caso típico del
                    // admin), la preseleccionamos: dejarla vacía haría fallar el
                    // guardado con "no puedes cambiar el establecimiento".
                    setReassignEstId(establishments.length === 1 ? establishments[0].id : "");
                    setReassignCourseId(""); setReassignSectionId(""); setBulkReassignOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-sidebar/30 text-sidebar bg-sidebar/5 hover:bg-sidebar/10 transition-colors cursor-pointer"
                >
                  <Pencil size={16} /> Reasignar
                </button>
                <button
                  onClick={() => setBulkSendCredsConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <KeyRound size={16} /> Enviar ahora
                </button>
                <button
                  onClick={() => setProgramarOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-sidebar/30 text-sidebar bg-sidebar/5 hover:bg-sidebar/10 transition-colors cursor-pointer"
                >
                  <CalendarClock size={16} /> Programar envío
                </button>
                {isSuperadmin && (
                  <button
                    onClick={() => { setBulkDeleteText(""); setBulkDeleteConfirm(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} /> Borrar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Programar envío de credenciales (servidor) */}
      {programarOpen && (
        <ProgramarEnvioModal
          userIds={Array.from(bulkSelectedIds)}
          onClose={() => setProgramarOpen(false)}
          onScheduled={() => {
            setBulkSelectedIds(new Set());
            setEnviosRefresh((n) => n + 1);
          }}
        />
      )}

      {/* Bulk send credentials confirmation modal */}
      {bulkSendCredsConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setBulkSendCredsConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <KeyRound size={22} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Enviar credenciales a {bulkSelectedIds.size} usuario(s)</h3>
                <p className="text-xs text-gray-400">Se enviará un correo a cada uno</p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              A cada usuario seleccionado se le generará una <strong>contraseña temporal nueva</strong> y se le enviará por correo. En su primer ingreso deberá crear su propia contraseña.
            </div>
            <div className="flex items-center gap-3">
              <button onClick={bulkSendCredentials}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-emerald-700 transition-colors">
                Enviar a {bulkSelectedIds.size}
              </button>
              <button onClick={() => setBulkSendCredsConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reporte de envío de credenciales */}
      {credsReport && (() => {
        const sent = credsReport.filter((r) => r.status === "sent");
        const failed = credsReport.filter((r) => r.status === "failed");
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => !bulkProcessing && setCredsReport(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <KeyRound size={22} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900">Reporte de envío de credenciales</h3>
                  <p className="text-xs text-gray-400">
                    {sent.length} enviada(s){failed.length > 0 ? ` · ${failed.length} con error` : ""} de {credsReport.length}
                  </p>
                </div>
                {!bulkProcessing && (
                  <button onClick={() => setCredsReport(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="Cerrar">
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-600" />
                  <div>
                    <p className="text-lg font-bold text-emerald-800 leading-none">{sent.length}</p>
                    <p className="text-[11px] text-emerald-700">Enviadas</p>
                  </div>
                </div>
                <div className={`rounded-xl border p-3 flex items-center gap-2 ${failed.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                  <AlertCircle size={18} className={failed.length > 0 ? "text-red-500" : "text-gray-300"} />
                  <div>
                    <p className={`text-lg font-bold leading-none ${failed.length > 0 ? "text-red-700" : "text-gray-400"}`}>{failed.length}</p>
                    <p className={`text-[11px] ${failed.length > 0 ? "text-red-600" : "text-gray-400"}`}>Con error</p>
                  </div>
                </div>
              </div>

              {/* Detalle: fallidos primero (accionables) */}
              <div className="max-h-[260px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {[...failed, ...sent].map((r) => (
                  <div key={r.id} className="flex items-start gap-2 px-3 py-2">
                    {r.status === "sent"
                      ? <CheckCircle size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      : <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{r.email}</p>
                      {r.status === "failed" && r.reason && (
                        <p className="text-[11px] text-red-600 mt-0.5">{r.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {bulkProcessing && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin text-sidebar" />
                  <span>Reintentando {bulkProgress?.current ?? 0} de {bulkProgress?.total ?? 0}...</span>
                </div>
              )}

              {!bulkProcessing && (
                <div className="flex items-center gap-2">
                  {failed.length > 0 && (
                    <button onClick={retryFailedCredentials}
                      className="inline-flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer">
                      <RotateCcw size={15} /> Reintentar fallidos ({failed.length})
                    </button>
                  )}
                  <button onClick={downloadCredsReport}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                    <Download size={15} /> Exportar CSV
                  </button>
                  <button onClick={() => setCredsReport(null)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Bulk reset confirmation modal */}
      {bulkResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setBulkResetConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <RotateCcw size={24} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">¿Restablecer datos de {bulkSelectedIds.size} usuarios?</h3>
                <p className="text-xs text-gray-400">Operación masiva irreversible</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium mb-2">Esta acción eliminará permanentemente para cada usuario seleccionado:</p>
              <ul className="space-y-1.5 text-sm text-amber-700">
                <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todas las sesiones y conversaciones con pacientes</li>
                <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todo el progreso (XP, nivel, racha)</li>
                <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todos los logros desbloqueados</li>
                <li className="flex items-start gap-2"><span className="mt-0.5">•</span> Todo el avance en aprendizaje</li>
              </ul>
              <p className="text-xs text-amber-600 font-semibold mt-3">Los {bulkSelectedIds.size} usuarios volverán a Nivel 1 con 0 XP. Esta acción no se puede deshacer.</p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={bulkResetData}
                className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                Sí, restablecer {bulkSelectedIds.size} usuarios
              </button>
              <button onClick={() => setBulkResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk reassign asignatura/sección modal */}
      {bulkReassignOpen && (() => {
        const reassignCourses = reassignEstId ? courses.filter((c) => c.establishment_id === reassignEstId) : [];
        const reassignSections = reassignCourseId ? sections.filter((s) => s.course_id === reassignCourseId) : [];
        const selectedUsers = users.filter((u) => bulkSelectedIds.has(u.id));
        const multiEst = new Set(selectedUsers.map((u) => u.establishment_id)).size > 1;
        const selectClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar/20 hover:border-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setBulkReassignOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sidebar/10 flex items-center justify-center">
                  <Pencil size={22} className="text-sidebar" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reasignar {bulkSelectedIds.size} usuario(s)</h3>
                  <p className="text-xs text-gray-400">Institución · Asignatura · Sección</p>
                </div>
              </div>

              {multiEst && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  Los seleccionados son de distintas instituciones. Al reasignar, <strong>todos</strong> quedarán en la institución que elijas abajo.
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Institución</label>
                  <select value={reassignEstId} onChange={(e) => { setReassignEstId(e.target.value); setReassignCourseId(""); setReassignSectionId(""); }} className={selectClass}>
                    <option value="">Selecciona una institución</option>
                    {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Asignatura</label>
                  <select value={reassignCourseId} onChange={(e) => { setReassignCourseId(e.target.value); setReassignSectionId(""); }} disabled={!reassignEstId} className={selectClass}>
                    <option value="">Sin asignar</option>
                    {reassignCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Sección</label>
                  <select value={reassignSectionId} onChange={(e) => setReassignSectionId(e.target.value)} disabled={!reassignCourseId} className={selectClass}>
                    <option value="">Sin asignar</option>
                    {reassignSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={bulkReassign} disabled={!reassignEstId}
                  className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#354080] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Reasignar {bulkSelectedIds.size}
                </button>
                <button onClick={() => setBulkReassignOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk hard delete confirmation modal — requires typing BORRAR */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Borrar {bulkSelectedIds.size} usuario(s)</h3>
                <p className="text-xs text-red-500 font-medium">Borrado definitivo e irreversible</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              Se eliminarán las cuentas y todos sus datos (sesiones, progreso, evaluaciones). <strong>No se puede deshacer.</strong>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Escribe <span className="font-bold">BORRAR</span> para confirmar
              </label>
              <input
                value={bulkDeleteText}
                onChange={(e) => setBulkDeleteText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="BORRAR"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={bulkDelete} disabled={bulkDeleteText !== "BORRAR"}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Borrar {bulkSelectedIds.size} definitivamente
              </button>
              <button onClick={() => setBulkDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity ${willDisable ? "bg-amber-500" : "bg-green-500"}`}>
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

      {/* Password reset / send credentials confirmation modal */}
      {passwordResetConfirm && (() => {
        const u = users.find((x) => x.id === passwordResetConfirm);
        if (!u) return null;
        const firstTime = u.credentials_sent_at == null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setPasswordResetConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sidebar/10 flex items-center justify-center">
                  <KeyRound size={24} className="text-sidebar" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {firstTime ? "¿Enviar credenciales?" : "¿Restablecer contraseña?"}
                  </h3>
                  <p className="text-xs text-gray-400">{u.full_name || u.email}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  {firstTime ? "Al enviar las credenciales:" : "Al restablecer la contraseña:"}
                </p>
                <ul className="space-y-1.5 text-sm text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span className="min-w-0">Se generará una contraseña temporal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span className="min-w-0">
                      Se enviará un correo con las credenciales a:
                      <span className="block mt-0.5 font-semibold text-blue-900 break-all">{u.email}</span>
                    </span>
                  </li>
                  {!firstTime && (
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      <span className="min-w-0">La contraseña anterior dejará de funcionar inmediatamente</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => resetPassword(passwordResetConfirm)} disabled={actionLoading === passwordResetConfirm}
                  className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                  {actionLoading === passwordResetConfirm
                    ? "Enviando..."
                    : firstTime ? "Sí, enviar credenciales" : "Sí, restablecer contraseña"}
                </button>
                <button onClick={() => setPasswordResetConfirm(null)}
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
                  className="end-session-btn flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
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
                  className="end-session-btn flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
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

interface CsvParsedRow {
  nombre: string;
  email: string;
  rol: string;
  asignatura: string;
  seccion: string;
}

interface CsvImportError {
  row: number;
  email: string;
  error: string;
}

interface CsvImportResult {
  total: number;
  created: number;
  errors: CsvImportError[];
}

function parseCsvPreview(text: string): CsvParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase().trim();
  const headers = headerLine.split(/[,;\t]+/).map((h) => h.trim().replace(/^"|"$/g, ""));

  const nameIdx = headers.findIndex((h) => h === "nombre" || h === "name" || h === "full_name");
  const emailIdx = headers.findIndex((h) => h === "email" || h === "correo");
  const rolIdx = headers.findIndex((h) => h === "rol" || h === "role");
  const asignaturaIdx = headers.findIndex((h) => h === "asignatura" || h === "course" || h === "curso");
  const seccionIdx = headers.findIndex((h) => h === "seccion" || h === "sección" || h === "section");

  if (emailIdx === -1) return [];

  const rows: CsvParsedRow[] = [];
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

function CsvImportSection({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    const text = await selectedFile.text();
    setCsvText(text);
    const rows = parseCsvPreview(text);
    setParsedRows(rows);
    if (rows.length === 0) {
      toast.error("No se encontraron filas válidas en el archivo. Verifica que tenga columnas: nombre, email");
    }
  };

  const downloadTemplate = () => {
    const templateContent = "nombre,email,rol,asignatura,seccion\nMaría López,maria.lopez@ejemplo.cl,student,Psicología Clínica,Sección A\nCarlos Ruiz,carlos.ruiz@ejemplo.cl,student,Psicología Clínica,Sección B\nAna Torres,ana.torres@ejemplo.cl,instructor,,";
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_importacion_usuarios.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/users/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al importar usuarios");
        setImporting(false);
        return;
      }

      setResult(data);

      if (data.errors.length === 0) {
        toast.success(`${data.created} usuarios creados exitosamente`);
      } else if (data.created > 0) {
        toast.warning(`${data.created} creados, ${data.errors.length} con errores`);
      } else {
        toast.error(`Ningún usuario fue creado. ${data.errors.length} errores encontrados`);
      }
    } catch {
      toast.error("Error de conexión al importar");
    }
    setImporting(false);
  };

  const rolLabel = (r: string) => {
    const labels: Record<string, string> = { student: "Alumno", instructor: "Docente", admin: "Admin" };
    return labels[r.toLowerCase()] || r || "Alumno";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-sidebar" />
          <h3 className="text-sm font-semibold text-gray-900">Importar usuarios desde CSV</h3>
        </div>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
      </div>

      {result ? (
        <div className="space-y-4">
          {/* Result summary */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <FileText size={16} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-lg font-bold text-gray-900">{result.total}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle size={16} className="text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Creados</p>
                <p className="text-lg font-bold text-green-600">{result.created}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Errores</p>
                  <p className="text-lg font-bold text-red-600">{result.errors.length}</p>
                </div>
              </div>
            )}
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-800 font-medium mb-2">Detalle de errores</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-medium">Fila {e.row}</span> ({e.email}): {e.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => { onClose(); router.refresh(); }}
              className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              Cerrar y actualizar
            </button>
            <button
              onClick={() => { setResult(null); setFile(null); setParsedRows([]); setCsvText(""); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-600 mb-2 font-medium">Formato del archivo CSV</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              El archivo debe contener las columnas: <span className="font-mono bg-gray-200 px-1 rounded">nombre</span>, <span className="font-mono bg-gray-200 px-1 rounded">email</span>, <span className="font-mono bg-gray-200 px-1 rounded">rol</span> (student/instructor), <span className="font-mono bg-gray-200 px-1 rounded">asignatura</span>, <span className="font-mono bg-gray-200 px-1 rounded">seccion</span>.
              Solo nombre y email son obligatorios. Si no se indica rol, se asigna "student".
            </p>
            <button onClick={downloadTemplate}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-sidebar font-medium hover:underline">
              <FileText size={14} />
              Descargar plantilla CSV
            </button>
          </div>

          {/* File input */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Archivo CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sidebar/10 file:text-sidebar hover:file:bg-sidebar/20"
            />
          </div>

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 mb-1">
                Vista previa ({parsedRows.length} {parsedRows.length === 1 ? "usuario" : "usuarios"})
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Nombre</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rol</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Asignatura</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Sección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map((row, i) => {
                      const hasError = !row.email.includes("@") || !row.nombre;
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${hasError ? "bg-red-50/50" : ""}`}>
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className={`px-3 py-1.5 ${!row.nombre ? "text-red-400 italic" : "text-gray-700"}`}>
                            {row.nombre || "Sin nombre"}
                          </td>
                          <td className={`px-3 py-1.5 ${!row.email.includes("@") ? "text-red-400" : "text-gray-700"}`}>
                            {row.email || "Sin email"}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{rolLabel(row.rol)}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.asignatura || "—"}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.seccion || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-[10px] text-gray-400 text-center py-2">
                    ...y {parsedRows.length - 20} filas más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
              className="flex items-center gap-2 bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {importing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Importar {parsedRows.length} {parsedRows.length === 1 ? "usuario" : "usuarios"}
                </>
              )}
            </button>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ establishments, courses, sections, isSuperadmin, onClose }: { establishments: { id: string; name: string }[]; courses: CourseOption[]; sections: SectionOption[]; isSuperadmin: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"single" | "text" | "excel">("single");
  // No silent default: the admin must consciously pick a role. Defaulting to
  // "student" caused docentes to be created as students by accident.
  const [role, setRole] = useState("");
  const [estId, setEstId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // Cascading options: courses belong to the selected institution, sections
  // belong to the selected course.
  const estCourses = estId ? courses.filter((c) => c.establishment_id === estId) : [];
  const courseSections = courseId ? sections.filter((s) => s.course_id === courseId) : [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; failed: number; results?: { email: string; success: boolean; error?: string }[] } | null>(null);
  // Default OFF: the admin explicitly decides when to send credentials from the list.
  const [sendCredentials, setSendCredentials] = useState(false);

  // Single mode
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  // Bulk text mode
  const [bulkText, setBulkText] = useState("");

  // Excel mode
  const [excelData, setExcelData] = useState<{ email: string; full_name: string }[]>([]);

  // Superadmin no se expone aquí: se crea manualmente en la BD por seguridad.
  const roleOptions = isSuperadmin
    ? [{ v: "student", l: "Alumno" }, { v: "instructor", l: "Docente" }, { v: "admin", l: "Admin" }]
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

    // Require an explicit role for every mode — no silent default.
    if (!role) { setError("Selecciona el rol del usuario (Alumno o Docente)"); setLoading(false); return; }

    try {
      if (mode === "single") {
        if (!email || !fullName) { setError("Email y nombre requeridos"); setLoading(false); return; }
        const body: Record<string, unknown> = {
          email,
          full_name: fullName,
          role,
          send_credentials: sendCredentials,
        };
        if (estId) body.establishment_id = estId;
        if (courseId) body.course_id = courseId;
        if (sectionId) body.section_id = sectionId;
        const res = await fetch("/api/admin/users/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); setLoading(false); return; }
        toast.success("Usuario creado");
        setResult({ created: 1, failed: 0 });
      } else {
        const users = mode === "text" ? parseBulkText(bulkText) : excelData;
        if (users.length === 0) { setError("No se encontraron usuarios válidos"); setLoading(false); return; }

        const bulkBody: Record<string, unknown> = { users, role };
        if (estId) bulkBody.establishment_id = estId;
        if (courseId) bulkBody.course_id = courseId;
        if (sectionId) bulkBody.section_id = sectionId;
        const res = await fetch("/api/admin/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bulkBody),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Error"); setLoading(false); return; }
        toast.success(`${data.created} usuarios creados`);
        setResult(data);
      }
    } catch {
      toast.error("Error de conexión al crear usuarios");
    } finally {
      setLoading(false);
    }
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
                className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer ${mode === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Common fields: role + institution */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Rol<HelpTip text="Estudiante: practica con pacientes. Docente: supervisa alumnos. Admin: gestiona institución" /></label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClass} hover:border-gray-300 cursor-pointer ${!role ? "text-gray-400" : ""}`}>
                <option value="" disabled>— Selecciona el rol —</option>
                {roleOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Institución</label>
              <select value={estId} onChange={(e) => { setEstId(e.target.value); setCourseId(""); setSectionId(""); }} className={`${inputClass} hover:border-gray-300 cursor-pointer`}>
                <option value="">Sin asignar</option>
                {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          {/* Asignatura + Sección (en cascada desde la institución) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Asignatura<HelpTip text="Define la sección que verá el docente. Selecciona primero una institución." /></label>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSectionId(""); }} disabled={!estId} className={`${inputClass} hover:border-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}>
                <option value="">Sin asignar</option>
                {estCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Sección</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!courseId} className={`${inputClass} hover:border-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}>
                <option value="">Sin asignar</option>
                {courseSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Mode-specific content */}
          {mode === "single" && (
            <>
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
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendCredentials}
                  onChange={(e) => setSendCredentials(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-sidebar focus:ring-sidebar"
                />
                <span className="text-xs text-gray-600">
                  Enviar credenciales por correo al crear
                </span>
                <HelpTip text="Si está desactivado, el usuario se crea sin notificación. Podrás enviarle las credenciales después desde la lista." />
              </label>
            </>
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
              className="bg-sidebar text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-sidebar-hover transition-colors">
              {loading ? "Creando..." : mode === "single" ? "Crear usuario" : `Crear ${mode === "text" ? parseBulkText(bulkText).length : excelData.length} usuarios`}
            </button>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
