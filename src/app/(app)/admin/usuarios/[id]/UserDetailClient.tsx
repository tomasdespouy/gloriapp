"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  currentFullName: string;
  currentRole: string;
  currentEstablishmentId: string | null;
  currentCourseId: string | null;
  currentSectionId: string | null;
  currentAdminScope: { course_id: string | null; section_id: string | null } | null;
  establishments: { id: string; name: string }[];
};

type Course = { id: string; name: string; code: string | null };
type Section = { id: string; name: string };

const ALL = "__ALL__"; // opción "Todas" (para el alcance de un admin)

export default function UserDetailClient({
  userId,
  currentFullName,
  currentRole,
  currentEstablishmentId,
  currentCourseId,
  currentSectionId,
  currentAdminScope,
  establishments,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(currentFullName);
  const [role, setRole] = useState(currentRole);
  const [estId, setEstId] = useState(currentEstablishmentId || "");
  // Para un ADMIN el alcance vive en admin_establishments (no en el perfil):
  //   sin fila → "" (Sin asignar = no ve nada); course NULL → ALL (Todas); si no, el curso.
  const [courseId, setCourseId] = useState(
    currentRole === "admin"
      ? (currentAdminScope === null ? "" : currentAdminScope.course_id === null ? ALL : currentAdminScope.course_id)
      : (currentCourseId || ""),
  );
  const [sectionId, setSectionId] = useState(
    currentRole === "admin" ? (currentAdminScope?.section_id || "") : (currentSectionId || ""),
  );
  const isAdmin = role === "admin";
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Load courses when establishment changes
  useEffect(() => {
    if (!estId) { setCourses([]); setCourseId(""); setSections([]); setSectionId(""); return; }
    fetch(`/api/admin/courses?establishment_id=${estId}`)
      .then((r) => r.json())
      .then((data) => {
        setCourses(data);
        if (courseId !== ALL && !data.find((c: Course) => c.id === courseId)) { setCourseId(""); setSections([]); setSectionId(""); }
      });
  }, [estId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sections when course changes ("Todas"/vacío no cargan secciones).
  useEffect(() => {
    if (!courseId || courseId === ALL) { setSections([]); setSectionId(""); return; }
    fetch(`/api/admin/sections?course_id=${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        setSections(data);
        if (!data.find((s: Section) => s.id === sectionId)) setSectionId("");
      });
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        role,
        establishment_id: estId || null,
        // El curso/sección del PERFIL solo aplica a no-admins. Para un admin, su
        // asignatura/sección es su ALCANCE y va a admin_establishments (abajo).
        course_id: isAdmin ? null : (courseId && courseId !== ALL ? courseId : null),
        section_id: isAdmin ? null : (sectionId || null),
        admin_scope: isAdmin ? {
          assigned: courseId !== "",                                  // "" = Sin asignar (no ve nada)
          course_id: courseId === ALL ? null : (courseId || null),    // ALL = Todas
          section_id: (courseId && courseId !== ALL) ? (sectionId || null) : null,
        } : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "Error al actualizar");
    } else {
      setMessage("Actualizado correctamente");
      router.refresh();
    }
    setLoading(false);
  };

  // Inline create helpers
  const [newCourse, setNewCourse] = useState("");
  const [newSection, setNewSection] = useState("");

  const createCourse = async () => {
    if (!newCourse.trim() || !estId) return;
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCourse.trim(), establishment_id: estId }),
    });
    if (res.ok) {
      const data = await res.json();
      setCourses((prev) => [...prev, data]);
      setCourseId(data.id);
      setNewCourse("");
    }
  };

  const createSection = async () => {
    if (!newSection.trim() || !courseId) return;
    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSection.trim(), course_id: courseId }),
    });
    if (res.ok) {
      const data = await res.json();
      setSections((prev) => [...prev, data]);
      setSectionId(data.id);
      setNewSection("");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-5">Modificar usuario</h3>

      <div className="space-y-5">
        {/* Nombre */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            placeholder="Nombre y apellido"
          />
        </div>

        {/* Rol */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-gray-300 cursor-pointer">
            <option value="student">Alumno</option>
            <option value="instructor">Instructor / Docente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        {/* Jerarquía: Institución → Asignatura → Sección */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asignación académica</p>

          {/* Institución */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Institución</label>
            <select value={estId} onChange={(e) => setEstId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-300 cursor-pointer">
              <option value="">Sin asignar</option>
              {establishments.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Asignatura */}
          {estId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asignatura</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-300 cursor-pointer">
                {isAdmin ? (
                  <>
                    <option value={ALL}>Todas las asignaturas</option>
                    <option value="">Sin asignar (no ve nada)</option>
                  </>
                ) : (
                  <option value="">Sin asignar</option>
                )}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>
                ))}
              </select>
              {isAdmin && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Define QUÉ ve/administra el admin: Todas = todo el establecimiento; una asignatura/sección = solo eso; Sin asignar = no ve nada.
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <input type="text" value={newCourse} onChange={(e) => setNewCourse(e.target.value)}
                  placeholder="Nueva asignatura..." className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <button onClick={createCourse} disabled={!newCourse.trim()}
                  className="text-xs text-sidebar font-medium hover:underline disabled:opacity-40">Crear</button>
              </div>
            </div>
          )}

          {/* Sección (no aplica cuando la asignatura es "Todas") */}
          {courseId && courseId !== ALL && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-300 cursor-pointer">
                <option value="">{isAdmin ? "Todas las secciones" : "Sin asignar"}</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 mt-1.5">
                <input type="text" value={newSection} onChange={(e) => setNewSection(e.target.value)}
                  placeholder="Nueva sección..." className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <button onClick={createSection} disabled={!newSection.trim()}
                  className="text-xs text-sidebar font-medium hover:underline disabled:opacity-40">Crear</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className={`text-sm mt-3 ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      <button onClick={handleSave} disabled={loading}
        className="mt-4 bg-sidebar text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50">
        {loading ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
