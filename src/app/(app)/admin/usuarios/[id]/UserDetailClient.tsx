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
  establishments: { id: string; name: string }[];
};

type Course = { id: string; name: string; code: string | null };
type Section = { id: string; name: string };

export default function UserDetailClient({
  userId,
  currentFullName,
  currentRole,
  currentEstablishmentId,
  currentCourseId,
  currentSectionId,
  establishments,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(currentFullName);
  const [role, setRole] = useState(currentRole);
  const [estId, setEstId] = useState(currentEstablishmentId || "");
  const [courseId, setCourseId] = useState(currentCourseId || "");
  const [sectionId, setSectionId] = useState(currentSectionId || "");
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
        if (!data.find((c: Course) => c.id === courseId)) { setCourseId(""); setSections([]); setSectionId(""); }
      });
  }, [estId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sections when course changes
  useEffect(() => {
    if (!courseId) { setSections([]); setSectionId(""); return; }
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
        course_id: courseId || null,
        section_id: sectionId || null,
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
            <option value="superadmin">Superadmin</option>
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
                <option value="">Sin asignar</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 mt-1.5">
                <input type="text" value={newCourse} onChange={(e) => setNewCourse(e.target.value)}
                  placeholder="Nueva asignatura..." className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                <button onClick={createCourse} disabled={!newCourse.trim()}
                  className="text-xs text-sidebar font-medium hover:underline disabled:opacity-40">Crear</button>
              </div>
            </div>
          )}

          {/* Sección */}
          {courseId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sección</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-gray-300 cursor-pointer">
                <option value="">Sin asignar</option>
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
