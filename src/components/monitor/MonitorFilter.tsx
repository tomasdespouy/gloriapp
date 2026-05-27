"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import type { RequestedScope } from "@/lib/monitor/scope";

// Filtro en cascada País → Universidad → Asignatura → Sección, con checkbox en
// cada nivel y multi-selección. Semántica de unión. Emite un RequestedScope
// compuesto; el servidor lo intersecta con la autoridad. Muestra los filtros
// elegidos como etiquetas removibles (X) junto al botón.

type SectionNode = { id: string; name: string };
type CourseNode = { id: string; name: string; code: string | null; sections: SectionNode[] };
type EstablishmentNode = { id: string; name: string; courses: CourseNode[] };
type CountryNode = { country: string; establishments: EstablishmentNode[] };

type Level = "country" | "est" | "course" | "section";
type Selection = Record<Level, string[]>;
const EMPTY: Selection = { country: [], est: [], course: [], section: [] };

export default function MonitorFilter({ onScopeChange }: { onScopeChange: (scope: RequestedScope) => void }) {
  const [tree, setTree] = useState<CountryNode[] | null>(null);
  const [sel, setSel] = useState<Selection>(EMPTY);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/monitor/filters")
      .then((r) => (r.ok ? r.json() : { countries: [] }))
      .then((d: { countries?: CountryNode[] }) => { if (!cancelled) setTree(d.countries || []); })
      .catch(() => { if (!cancelled) setTree([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Etiquetas id→nombre para las chips.
  const labels = useMemo(() => {
    const m: Record<Level, Map<string, string>> = { country: new Map(), est: new Map(), course: new Map(), section: new Map() };
    for (const c of tree || []) {
      m.country.set(c.country, c.country);
      for (const e of c.establishments) {
        m.est.set(e.id, e.name);
        for (const co of e.courses) {
          m.course.set(co.id, co.name);
          for (const s of co.sections) m.section.set(s.id, s.name);
        }
      }
    }
    return m;
  }, [tree]);

  const apply = (next: Selection) => {
    setSel(next);
    const empty = !next.country.length && !next.est.length && !next.course.length && !next.section.length;
    onScopeChange(
      empty
        ? { kind: "all" }
        : { kind: "filter", countries: next.country, establishmentIds: next.est, courseIds: next.course, sectionIds: next.section },
    );
  };
  const toggle = (level: Level, id: string) => {
    const cur = sel[level];
    apply({ ...sel, [level]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const total = sel.country.length + sel.est.length + sel.course.length + sel.section.length;

  const hasSomethingToFilter = !!tree && tree.length > 0 &&
    (tree.length > 1 || tree.some((c) => c.establishments.length > 1 || c.establishments.some((e) => e.courses.length > 0)));
  if (tree === null || !hasSomethingToFilter) return null;

  const chips: { level: Level; id: string; label: string }[] = (["country", "est", "course", "section"] as Level[])
    .flatMap((lvl) => sel[lvl].map((id) => ({ level: lvl, id, label: labels[lvl].get(id) || id })));

  const Check = ({ level, id }: { level: Level; id: string }) => (
    <input type="checkbox" checked={sel[level].includes(id)} onChange={() => toggle(level, id)} className="accent-sidebar" />
  );
  const Caret = ({ id }: { id: string }) => (
    <button onClick={() => toggleExpand(id)} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="Expandir">
      {expanded.has(id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5 flex-wrap" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-xs h-9 px-3 rounded-lg border cursor-pointer ${
            total > 0 ? "bg-sidebar/10 border-sidebar/40 text-sidebar" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Filter size={14} />
          {total > 0 ? `Filtrando (${total})` : "Filtrar grupos"}
          <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-[340px] max-h-[440px] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2">
            {tree.map((country) => (
              <div key={country.country} className="py-0.5">
                <div className="flex items-center gap-1">
                  <Caret id={`c:${country.country}`} />
                  <label className="flex items-center gap-2 flex-1 text-sm font-medium text-gray-800 cursor-pointer py-0.5">
                    <Check level="country" id={country.country} />
                    <span className="truncate">{country.country}</span>
                  </label>
                </div>
                {expanded.has(`c:${country.country}`) && country.establishments.map((est) => (
                  <div key={est.id} className="ml-6">
                    <div className="flex items-center gap-1">
                      {est.courses.length > 0 ? <Caret id={`e:${est.id}`} /> : <span className="w-5" />}
                      <label className="flex items-center gap-2 flex-1 text-[13px] text-gray-700 cursor-pointer py-0.5">
                        <Check level="est" id={est.id} />
                        <span className="truncate">{est.name}</span>
                      </label>
                    </div>
                    {expanded.has(`e:${est.id}`) && est.courses.map((course) => (
                      <div key={course.id} className="ml-6">
                        <div className="flex items-center gap-1">
                          {course.sections.length > 0 ? <Caret id={`co:${course.id}`} /> : <span className="w-5" />}
                          <label className="flex items-center gap-2 flex-1 text-[13px] text-gray-600 cursor-pointer py-0.5">
                            <Check level="course" id={course.id} />
                            <span className="truncate">{course.name}</span>
                          </label>
                        </div>
                        {expanded.has(`co:${course.id}`) && course.sections.map((section) => (
                          <label key={section.id} className="ml-11 flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer py-0.5">
                            <Check level="section" id={section.id} />
                            <span className="truncate">{section.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Etiquetas de filtros elegidos, removibles */}
      {chips.map((chip) => (
        <span key={`${chip.level}:${chip.id}`} className="inline-flex items-center gap-1 text-[11px] bg-sidebar/10 text-sidebar border border-sidebar/30 rounded-full pl-2 pr-1 py-0.5">
          <span className="truncate max-w-[120px]">{chip.label}</span>
          <button onClick={() => toggle(chip.level, chip.id)} className="hover:bg-sidebar/20 rounded-full p-0.5 cursor-pointer" aria-label={`Quitar ${chip.label}`}>
            <X size={11} />
          </button>
        </span>
      ))}
      {total > 1 && (
        <button onClick={() => apply(EMPTY)} className="text-[11px] text-gray-400 hover:text-gray-700 cursor-pointer">
          Limpiar todo
        </button>
      )}
    </div>
  );
}
