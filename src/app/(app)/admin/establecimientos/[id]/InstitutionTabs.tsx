"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings, ShieldCheck, BookOpen, GraduationCap, Users,
  Plus, Trash2, ChevronDown, ChevronRight, UserPlus, X,
  UserRound, Check, Globe, Star,
} from "lucide-react";
import EstablishmentForm from "../EstablishmentForm";

type Profile = { id: string; full_name: string | null; email: string; role?: string; course_id?: string | null; section_id?: string | null };
type Course = { id: string; name: string; code: string | null; establishment_id: string; is_active: boolean };
type Section = { id: string; name: string; course_id: string; is_active: boolean };
type Patient = { id: string; name: string; age: number | null; occupation: string | null; difficulty_level: string | null; country: string[] | null; is_active: boolean; tags: string[] | null; country_origin: string | null; country_residence: string | null };

type Props = {
  establishment: Record<string, unknown>;
  assignedAdmins: Profile[];
  availableAdmins: Profile[];
  courses: Course[];
  courseSections: Record<string, Section[]>;
  instructors: Profile[];
  students: Profile[];
  isSuperadmin: boolean;
  allPatients: Patient[];
  assignedPatientIds: string[];
  estCountry: string | null;
};

const TABS = [
  { key: "general", label: "General", icon: Settings },
  { key: "patients", label: "Pacientes", icon: UserRound },
  { key: "admins", label: "Administradores", icon: ShieldCheck },
  { key: "courses", label: "Asignaturas", icon: BookOpen },
  { key: "instructors", label: "Docentes", icon: GraduationCap },
  { key: "students", label: "Alumnos", icon: Users },
];

export default function InstitutionTabs(props: Props) {
  const [tab, setTab] = useState("general");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-btn flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
              tab === t.key
                ? "border-sidebar text-sidebar"
                : "border-transparent text-gray-400"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <TabGeneral establishment={props.establishment} isSuperadmin={props.isSuperadmin} />}
      {tab === "patients" && <TabPatients estId={String(props.establishment.id)} allPatients={props.allPatients} assignedPatientIds={props.assignedPatientIds} estCountry={props.estCountry} isSuperadmin={props.isSuperadmin} />}
      {tab === "admins" && <TabAdmins estId={String(props.establishment.id)} assigned={props.assignedAdmins} available={props.availableAdmins} />}
      {tab === "courses" && <TabCourses estId={String(props.establishment.id)} courses={props.courses} courseSections={props.courseSections} />}
      {tab === "instructors" && <TabInstructors estId={String(props.establishment.id)} instructors={props.instructors} courses={props.courses} courseSections={props.courseSections} />}
      {tab === "students" && <TabStudents estId={String(props.establishment.id)} students={props.students} courses={props.courses} courseSections={props.courseSections} />}
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: General
// ════════════════════════════════════════════
function TabGeneral({ establishment, isSuperadmin }: { establishment: Record<string, unknown>; isSuperadmin: boolean }) {
  if (!isSuperadmin) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <dl className="grid grid-cols-2 gap-4">
          {[["Nombre", "name"], ["País", "country"], ["Slug", "slug"], ["Contacto", "contact_name"]].map(([label, key]) => (
            <div key={key}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-medium text-gray-900">{String(establishment[key] || "—")}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <EstablishmentForm establishment={establishment as { id: string; name: string; slug: string; country?: string; logo_url?: string; website_url?: string; contact_name?: string; contact_email?: string; is_active?: boolean }} />
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: Administradores
// ════════════════════════════════════════════
function TabAdmins({ estId, assigned, available }: { estId: string; assigned: Profile[]; available: Profile[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const assign = async (adminId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/establishments/${estId}/admins`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId, _action: "add" }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Administrador asignado");
      router.refresh();
    } catch {
      toast.error("Error al asignar administrador");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (adminId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/establishments/${estId}/admins`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId, _action: "remove" }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Administrador removido");
      router.refresh();
    } catch {
      toast.error("Error al remover administrador");
    } finally {
      setLoading(false);
    }
  };

  const createAndAssign = async () => {
    if (!newEmail.trim() || !newName.trim()) return;
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, full_name: newName, role: "admin", establishment_id: estId }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error al crear"); setCreating(false); return; }
      const data = await res.json();
      // Assign to this institution
      const assignRes = await fetch(`/api/admin/establishments/${estId}/admins`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: data.user?.user?.id, _action: "add" }),
      });
      if (!assignRes.ok) throw new Error("Error al asignar");
      toast.success("Administrador creado y asignado");
      setShowCreate(false); setNewEmail(""); setNewName("");
      router.refresh();
    } catch {
      toast.error("Error al crear administrador");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Assigned */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Administradores asignados ({assigned.length})</h3>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 text-xs text-sidebar font-medium hover:underline">
            <UserPlus size={14} /> Crear y asignar
          </button>
        </div>

        {assigned.length > 0 ? (
          <div className="space-y-2">
            {assigned.map((a) => (
              <div key={a.id} className={`flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl ${loading ? "opacity-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.full_name || a.email}</p>
                  <p className="text-[10px] text-gray-400">{a.email}</p>
                </div>
                <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin administradores asignados</p>
        )}

        {/* Assign existing */}
        {available.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <select id="assign-admin" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {available.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
            </select>
            <button onClick={() => {
              const sel = (document.getElementById("assign-admin") as HTMLSelectElement)?.value;
              if (sel) assign(sel);
            }} className="bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors">
              Asignar
            </button>
          </div>
        )}
      </div>

      {/* Create new admin */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-sidebar/20 p-6 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Crear nuevo administrador</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="admin@institucion.cl" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={createAndAssign} disabled={creating || !newEmail.trim() || !newName.trim()}
              className="bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
              {creating ? "Creando..." : "Crear y asignar"}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: Asignaturas + Secciones
// ════════════════════════════════════════════
function TabCourses({ estId, courses, courseSections }: { estId: string; courses: Course[]; courseSections: Record<string, Section[]> }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState("");
  const [newSectionFor, setNewSectionFor] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [loading, setLoading] = useState(false);

  const createCourse = async () => {
    if (!newCourse.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCourse.trim(), establishment_id: estId }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Asignatura creada");
      setNewCourse(""); router.refresh();
    } catch {
      toast.error("Error al crear la asignatura");
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("¿Eliminar esta asignatura y todas sus secciones?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Asignatura eliminada");
      router.refresh();
    } catch {
      toast.error("Error al eliminar la asignatura");
    } finally {
      setLoading(false);
    }
  };

  const createSection = async (courseId: string) => {
    if (!newSectionName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSectionName.trim(), course_id: courseId }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Sección creada");
      setNewSectionName(""); setNewSectionFor(null); router.refresh();
    } catch {
      toast.error("Error al crear la sección");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Create course */}
      <div className="flex items-center gap-2">
        <input value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="Nombre de la asignatura..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={createCourse} disabled={loading || !newCourse.trim()}
          className="flex items-center gap-1.5 bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
          <Plus size={14} /> Crear asignatura
        </button>
      </div>

      {/* Course list */}
      {courses.map((course) => {
        const secs = courseSections[course.id] || [];
        const isOpen = expanded === course.id;
        return (
          <div key={course.id} className={`bg-white rounded-2xl border border-gray-200 overflow-hidden ${loading ? "opacity-50" : ""}`}>
            <button onClick={() => setExpanded(isOpen ? null : course.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
              {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              <BookOpen size={16} className="text-sidebar" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{course.name}</p>
                <p className="text-[10px] text-gray-400">{secs.length} {secs.length === 1 ? "sección" : "secciones"}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-2 bg-gray-50 animate-fade-in">
                {secs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg text-sm">
                    <span className="text-gray-700">{s.name}</span>
                  </div>
                ))}
                {newSectionFor === course.id ? (
                  <div className="flex items-center gap-2">
                    <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Nombre de la sección..." className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" autoFocus />
                    <button onClick={() => createSection(course.id)} disabled={!newSectionName.trim()}
                      className="text-xs text-sidebar font-medium hover:underline disabled:opacity-40">Crear</button>
                    <button onClick={() => { setNewSectionFor(null); setNewSectionName(""); }}
                      className="text-xs text-gray-400"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setNewSectionFor(course.id)}
                    className="flex items-center gap-1 text-xs text-sidebar font-medium hover:underline">
                    <Plus size={12} /> Agregar sección
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {courses.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-6">No hay asignaturas. Crea la primera arriba.</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: Docentes
// ════════════════════════════════════════════
function TabInstructors({ estId, instructors, courses, courseSections }: { estId: string; instructors: Profile[]; courses: Course[]; courseSections: Record<string, Section[]> }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const sections = courseId ? (courseSections[courseId] || []) : [];

  const handleCreate = async () => {
    if (!email.trim() || !name.trim()) return;
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name, role: "instructor", establishment_id: estId }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); setCreating(false); return; }
      const data = await res.json();
      const userId = data.user?.user?.id;
      if (userId && (courseId || sectionId)) {
        await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: courseId || null, section_id: sectionId || null }),
        });
      }
      toast.success("Docente creado");
      setShowCreate(false); setEmail(""); setName(""); setCourseId(""); setSectionId("");
      router.refresh();
    } catch {
      toast.error("Error al crear docente");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Docentes ({instructors.length})</h3>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 text-xs text-sidebar font-medium hover:underline">
            <UserPlus size={14} /> Crear docente
          </button>
        </div>

        {instructors.length > 0 ? (
          <div className="space-y-2">
            {instructors.map((t) => {
              const course = courses.find((c) => c.id === t.course_id);
              const section = Object.values(courseSections).flat().find((s) => s.id === t.section_id);
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.full_name || t.email}</p>
                    <p className="text-[10px] text-gray-400">
                      {t.email}
                      {course && <span> &middot; {course.name}</span>}
                      {section && <span> &middot; {section.name}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin docentes asignados</p>
        )}
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-sidebar/20 p-6 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Crear nuevo docente</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asignatura</label>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSectionId(""); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Sin asignar</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!courseId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-40">
                <option value="">Sin asignar</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleCreate} disabled={creating || !email.trim() || !name.trim()}
              className="bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
              {creating ? "Creando..." : "Crear docente"}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: Alumnos
// ════════════════════════════════════════════
function TabStudents({ estId, students, courses, courseSections }: { estId: string; students: Profile[]; courses: Course[]; courseSections: Record<string, Section[]> }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState("");

  const sections = courseId ? (courseSections[courseId] || []) : [];
  const bulkSections = bulkCourseId ? (courseSections[bulkCourseId] || []) : [];

  const handleCreate = async () => {
    if (!email.trim() || !name.trim()) return;
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name, role: "student", establishment_id: estId }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); setCreating(false); return; }
      const data = await res.json();
      const userId = data.user?.user?.id;
      if (userId && (courseId || sectionId)) {
        await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: courseId || null, section_id: sectionId || null }),
        });
      }
      toast.success("Alumno creado");
      setShowCreate(false); setEmail(""); setName(""); setCourseId(""); setSectionId("");
      router.refresh();
    } catch {
      toast.error("Error al crear alumno");
    } finally {
      setCreating(false);
    }
  };

  const handleBulkCreate = async () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return;
    setBulkLoading(true); setBulkResult("");
    let created = 0; let failed = 0;

    try {
      for (const line of lines) {
        const parts = line.split(/[,;\t]+/).map((s) => s.trim());
        const lineEmail = parts.find((p) => p.includes("@"));
        const lineName = parts.find((p) => !p.includes("@")) || lineEmail?.split("@")[0] || "";
        if (!lineEmail) { failed++; continue; }

        const res = await fetch("/api/admin/users/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: lineEmail, full_name: lineName, role: "student", establishment_id: estId }),
        });

        if (res.ok) {
          created++;
          const data = await res.json();
          const userId = data.user?.user?.id;
          if (userId && (bulkCourseId || bulkSectionId)) {
            await fetch(`/api/admin/users/${userId}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ course_id: bulkCourseId || null, section_id: bulkSectionId || null }),
            });
          }
        } else { failed++; }
      }

      setBulkResult(`${created} creados, ${failed} con error`);
      if (created > 0) {
        toast.success(`${created} alumnos creados`);
        router.refresh();
      }
      if (failed > 0) toast.error(`${failed} alumnos con error`);
    } catch {
      toast.error("Error durante la carga masiva");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Alumnos ({students.length})</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}
              className="flex items-center gap-1.5 text-xs text-gray-500 font-medium hover:text-sidebar hover:underline">
              <Users size={14} /> Carga masiva
            </button>
            <button onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}
              className="flex items-center gap-1.5 text-xs text-sidebar font-medium hover:underline">
              <UserPlus size={14} /> Crear alumno
            </button>
          </div>
        </div>

        {students.length > 0 ? (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {students.map((s) => {
              const course = courses.find((c) => c.id === s.course_id);
              const section = Object.values(courseSections).flat().find((sec) => sec.id === s.section_id);
              return (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.full_name || s.email}</p>
                    <p className="text-[10px] text-gray-400">
                      {s.email}
                      {course && <span> &middot; {course.name}</span>}
                      {section && <span> &middot; {section.name}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin alumnos registrados</p>
        )}
      </div>

      {/* Create individual */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-sidebar/20 p-6 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Crear alumno</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asignatura</label>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSectionId(""); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Sin asignar</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!courseId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-40">
                <option value="">Sin asignar</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleCreate} disabled={creating || !email.trim() || !name.trim()}
              className="bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
              {creating ? "Creando..." : "Crear alumno"}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* Bulk create */}
      {showBulk && (
        <div className="bg-white rounded-2xl border border-sidebar/20 p-6 animate-fade-in">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Carga masiva de alumnos</h4>
          <p className="text-xs text-gray-400 mb-3">Un alumno por línea. Formato: <code className="bg-gray-100 px-1 rounded">Nombre, email@ejemplo.cl</code></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asignatura (para todos)</label>
              <select value={bulkCourseId} onChange={(e) => { setBulkCourseId(e.target.value); setBulkSectionId(""); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Sin asignar</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección (para todos)</label>
              <select value={bulkSectionId} onChange={(e) => setBulkSectionId(e.target.value)} disabled={!bulkCourseId} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-40">
                <option value="">Sin asignar</option>
                {bulkSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} placeholder={"María López, maria@ejemplo.cl\nCarlos Ruiz, carlos@ejemplo.cl\nAna Torres, ana@ejemplo.cl"} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono resize-y" />
          {bulkResult && <p className="text-xs text-green-600 mt-2">{bulkResult}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleBulkCreate} disabled={bulkLoading || !bulkText.trim()}
              className="bg-sidebar text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
              {bulkLoading ? "Procesando..." : `Crear ${bulkText.trim().split("\n").filter(Boolean).length} alumnos`}
            </button>
            <button onClick={() => setShowBulk(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// TAB: Pacientes
// ════════════════════════════════════════════
const DIFFICULTY_COLORS: Record<string, string> = {
  principiante: "bg-green-100 text-green-700",
  intermedio: "bg-yellow-100 text-yellow-700",
  avanzado: "bg-red-100 text-red-700",
};

function TabPatients({
  estId, allPatients, assignedPatientIds, estCountry, isSuperadmin,
}: {
  estId: string; allPatients: Patient[]; assignedPatientIds: string[]; estCountry: string | null; isSuperadmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAvailable, setShowAvailable] = useState(false);
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  // Derive unique values for filters
  const origins = Array.from(new Set(allPatients.map((p) => p.country_origin).filter(Boolean))) as string[];
  const levels = Array.from(new Set(allPatients.map((p) => p.difficulty_level).filter(Boolean))) as string[];

  const assignedSet = new Set(assignedPatientIds);

  // Patients visible by country default
  const byCountry = allPatients.filter(
    (p) => estCountry && p.country?.includes(estCountry)
  );
  const byCountryIds = new Set(byCountry.map((p) => p.id));

  // Explicitly assigned patients (premium)
  const explicitlyAssigned = allPatients.filter(
    (p) => assignedSet.has(p.id) && !byCountryIds.has(p.id)
  );

  // All visible patients combined
  const visiblePatients = [
    ...byCountry.map((p) => ({ ...p, source: "country" as const })),
    ...explicitlyAssigned.map((p) => ({ ...p, source: "assigned" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Available for assignment (not already visible)
  const visibleIds = new Set(visiblePatients.map((p) => p.id));
  const available = allPatients
    .filter((p) => !visibleIds.has(p.id) && p.is_active)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !filterOrigin || p.country_origin === filterOrigin)
    .filter((p) => !filterLevel || p.difficulty_level === filterLevel);

  const assign = async (patientId: string) => {
    setLoading(patientId);
    try {
      const res = await fetch(`/api/admin/establishments/${estId}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, _action: "add" }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Paciente asignado");
      router.refresh();
    } catch {
      toast.error("Error al asignar paciente");
    } finally {
      setLoading(null);
    }
  };

  const remove = async (patientId: string) => {
    setLoading(patientId);
    try {
      const res = await fetch(`/api/admin/establishments/${estId}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, _action: "remove" }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Paciente removido");
      router.refresh();
    } catch {
      toast.error("Error al remover paciente");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Visible patients */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Pacientes visibles ({visiblePatients.length})
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {byCountry.length} por pa&iacute;s ({estCountry || "sin pa\u00eds"})
              {explicitlyAssigned.length > 0 && ` + ${explicitlyAssigned.length} asignados`}
            </p>
          </div>
          {isSuperadmin && (
            <button
              onClick={() => setShowAvailable(!showAvailable)}
              className="flex items-center gap-1.5 text-xs text-sidebar font-medium hover:underline"
            >
              <Plus size={14} /> Asignar pacientes
            </button>
          )}
        </div>

        {visiblePatients.length > 0 ? (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {visiblePatients.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${
                  loading === p.id ? "opacity-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {p.source === "country" ? (
                      <Globe size={14} className="text-gray-400" />
                    ) : (
                      <Star size={14} className="text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.difficulty_level && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[p.difficulty_level] || "bg-gray-100 text-gray-500"}`}>
                          {p.difficulty_level}
                        </span>
                      )}
                      {!p.is_active && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {p.age && `${p.age} a\u00f1os`}
                      {p.occupation && ` \u00b7 ${p.occupation}`}
                      {p.country && ` \u00b7 ${p.country.join(", ")}`}
                    </p>
                  </div>
                </div>
                {isSuperadmin && p.source === "assigned" && (
                  <button
                    onClick={() => remove(p.id)}
                    className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    Quitar
                  </button>
                )}
                {p.source === "country" && (
                  <span className="text-[9px] text-gray-300 flex-shrink-0">Por pa&iacute;s</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {estCountry
              ? `No hay pacientes configurados para ${estCountry}. Asigna pacientes manualmente.`
              : "Esta instituci\u00f3n no tiene pa\u00eds asignado. Configura el pa\u00eds en la pesta\u00f1a General o asigna pacientes manualmente."}
          </p>
        )}
      </div>

      {/* Available patients for assignment */}
      {showAvailable && isSuperadmin && (
        <div className="bg-white rounded-2xl border border-sidebar/20 p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">
              Asignar pacientes adicionales
            </h4>
            <button onClick={() => setShowAvailable(false)}>
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="flex-1 min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
            >
              <option value="">Pa&iacute;s de origen</option>
              {origins.sort().map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
            >
              <option value="">Nivel</option>
              {levels.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
            </select>
          </div>
          {available.length > 0 ? (
            <>
            {(filterOrigin || filterLevel) && available.length > 1 && (
              <button
                onClick={async () => {
                  try {
                    for (const p of available) {
                      await fetch(`/api/admin/establishments/${estId}/patients`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ patient_id: p.id, _action: "add" }),
                      });
                    }
                    toast.success(`${available.length} pacientes asignados`);
                    router.refresh();
                  } catch {
                    toast.error("Error al asignar pacientes");
                  }
                }}
                className="w-full text-xs text-sidebar font-medium hover:underline mb-2 text-left"
              >
                Asignar los {available.length} pacientes filtrados
              </button>
            )}
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {available.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors ${
                    loading === p.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.difficulty_level && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[p.difficulty_level] || "bg-gray-100 text-gray-500"}`}>
                          {p.difficulty_level}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {p.age && `${p.age} a\u00f1os`}
                      {p.occupation && ` \u00b7 ${p.occupation}`}
                      {p.country && ` \u00b7 ${p.country.join(", ")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => assign(p.id)}
                    disabled={loading === p.id}
                    className="flex items-center gap-1 text-xs text-sidebar font-medium hover:underline disabled:opacity-50 flex-shrink-0"
                  >
                    <Check size={12} /> Asignar
                  </button>
                </div>
              ))}
            </div>
          </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              {search || filterOrigin || filterLevel ? "Sin resultados para los filtros aplicados" : "Todos los pacientes activos ya est\u00e1n visibles para esta instituci\u00f3n"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
