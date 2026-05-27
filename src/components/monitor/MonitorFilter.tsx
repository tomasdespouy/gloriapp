"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import type { RequestedScope } from "@/lib/monitor/scope";

// Filtro en cascada Universidad → Asignatura → Sección con checkbox en cada
// nivel. Semántica de unión: marcar una universidad incluye a todos sus
// alumnos; marcar asignaturas o secciones puntuales incluye solo esas. Emite
// un RequestedScope compuesto; el servidor lo intersecta con la autoridad.

type SectionNode = { id: string; name: string };
type CourseNode = { id: string; name: string; code: string | null; sections: SectionNode[] };
type EstablishmentNode = { id: string; name: string; courses: CourseNode[] };

type Selection = { est: string[]; course: string[]; section: string[] };
const EMPTY: Selection = { est: [], course: [], section: [] };

export default function MonitorFilter({ onScopeChange }: { onScopeChange: (scope: RequestedScope) => void }) {
  const [tree, setTree] = useState<EstablishmentNode[] | null>(null);
  const [sel, setSel] = useState<Selection>(EMPTY);
  const [open, setOpen] = useState(false);
  const [expandedEst, setExpandedEst] = useState<string[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/monitor/filters")
      .then((r) => (r.ok ? r.json() : { establishments: [] }))
      .then((d: { establishments?: EstablishmentNode[] }) => { if (!cancelled) setTree(d.establishments || []); })
      .catch(() => { if (!cancelled) setTree([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const apply = (next: Selection) => {
    setSel(next);
    const empty = !next.est.length && !next.course.length && !next.section.length;
    onScopeChange(
      empty
        ? { kind: "all" }
        : { kind: "filter", establishmentIds: next.est, courseIds: next.course, sectionIds: next.section },
    );
  };

  const toggle = (level: keyof Selection, id: string) => {
    const cur = sel[level];
    apply({ ...sel, [level]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const toggleArr = (arr: string[], setArr: (v: string[]) => void, id: string) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const total = sel.est.length + sel.course.length + sel.section.length;

  // No mostrar el filtro si no hay nada que filtrar (1 universidad sin asignaturas).
  const hasSomethingToFilter =
    !!tree && (tree.length > 1 || tree.some((e) => e.courses.length > 0));
  if (tree === null || !hasSomethingToFilter) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border cursor-pointer ${
          total > 0 ? "bg-sidebar/10 border-sidebar/40 text-sidebar" : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        <Filter size={14} />
        {total > 0 ? `Filtrando (${total})` : "Filtrar grupos"}
        <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {total > 0 && (
        <button
          onClick={() => apply(EMPTY)}
          className="ml-2 text-[11px] text-gray-400 hover:text-gray-700 cursor-pointer"
        >
          Limpiar
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-2 w-[320px] max-h-[420px] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2">
          {tree.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Sin grupos para filtrar.</p>
          )}
          {tree.map((est) => {
            const estOpen = expandedEst.includes(est.id);
            return (
              <div key={est.id} className="py-0.5">
                <div className="flex items-center gap-1">
                  {est.courses.length > 0 ? (
                    <button
                      onClick={() => toggleArr(expandedEst, setExpandedEst, est.id)}
                      className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
                      aria-label="Expandir"
                    >
                      {estOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                  <label className="flex items-center gap-2 flex-1 text-sm text-gray-800 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={sel.est.includes(est.id)}
                      onChange={() => toggle("est", est.id)}
                      className="accent-sidebar"
                    />
                    <span className="truncate">{est.name}</span>
                  </label>
                </div>

                {estOpen && est.courses.map((course) => {
                  const courseOpen = expandedCourse.includes(course.id);
                  return (
                    <div key={course.id} className="ml-6">
                      <div className="flex items-center gap-1">
                        {course.sections.length > 0 ? (
                          <button
                            onClick={() => toggleArr(expandedCourse, setExpandedCourse, course.id)}
                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
                            aria-label="Expandir"
                          >
                            {courseOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <label className="flex items-center gap-2 flex-1 text-[13px] text-gray-700 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={sel.course.includes(course.id)}
                            onChange={() => toggle("course", course.id)}
                            className="accent-sidebar"
                          />
                          <span className="truncate">{course.name}</span>
                        </label>
                      </div>

                      {courseOpen && course.sections.map((section) => (
                        <label key={section.id} className="ml-11 flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={sel.section.includes(section.id)}
                            onChange={() => toggle("section", section.id)}
                            className="accent-sidebar"
                          />
                          <span className="truncate">{section.name}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {total > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 mt-2 pt-2 px-1">
              <span className="text-[11px] text-gray-400">{total} seleccionado{total === 1 ? "" : "s"}</span>
              <button
                onClick={() => apply(EMPTY)}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                <X size={12} /> Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
