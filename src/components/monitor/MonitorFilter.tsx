"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import type { RequestedScope } from "@/lib/monitor/scope";

// Filtro en cascada País → Universidad → Asignatura → Sección. Cada nivel es un
// checkbox; al marcar un nodo se marcan también sus ancestros, y cada uno
// aparece como una cápsula independiente removible. El alcance efectivo es el
// nodo MÁS ESPECÍFICO seleccionado por rama (un nodo cuenta solo si no tiene un
// descendiente también seleccionado): así, si quitas la sección pero dejas la
// asignatura, ves todas las secciones de esa asignatura.

type SectionNode = { id: string; name: string };
type CourseNode = { id: string; name: string; code: string | null; sections: SectionNode[] };
type EstablishmentNode = { id: string; name: string; courses: CourseNode[] };
type CountryNode = { country: string; establishments: EstablishmentNode[] };

type Level = "country" | "est" | "course" | "section";
const PREFIX: Record<Level, string> = { country: "country:", est: "est:", course: "course:", section: "section:" };
const key = (level: Level, id: string) => `${PREFIX[level]}${id}`;

export default function MonitorFilter({ onScopeChange }: { onScopeChange: (scope: RequestedScope) => void }) {
  const [tree, setTree] = useState<CountryNode[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
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

  // nombre y padre de cada nodo (clave `level:id`).
  const { nodeName, parentKey } = useMemo(() => {
    const nodeName = new Map<string, string>();
    const parentKey = new Map<string, string | undefined>();
    for (const c of tree || []) {
      const ck = key("country", c.country);
      nodeName.set(ck, c.country); parentKey.set(ck, undefined);
      for (const e of c.establishments) {
        const ek = key("est", e.id);
        nodeName.set(ek, e.name); parentKey.set(ek, ck);
        for (const co of e.courses) {
          const cok = key("course", co.id);
          nodeName.set(cok, co.name); parentKey.set(cok, ek);
          for (const s of co.sections) {
            const sk = key("section", s.id);
            nodeName.set(sk, s.name); parentKey.set(sk, cok);
          }
        }
      }
    }
    return { nodeName, parentKey };
  }, [tree]);

  const ancestorsOf = (k: string): string[] => {
    const out: string[] = [];
    let p = parentKey.get(k);
    while (p) { out.push(p); p = parentKey.get(p); }
    return out;
  };

  // Nodos efectivos: los que no tienen un descendiente también seleccionado.
  const effectiveKeys = (set: Set<string>): string[] =>
    [...set].filter((k) => ![...set].some((j) => j !== k && ancestorsOf(j).includes(k)));

  const apply = (next: Set<string>) => {
    setSel(next);
    if (next.size === 0) { onScopeChange({ kind: "all" }); return; }
    const eff = effectiveKeys(next);
    const strip = (lvl: Level) => eff.filter((k) => k.startsWith(PREFIX[lvl])).map((k) => k.slice(PREFIX[lvl].length));
    onScopeChange({
      kind: "filter",
      countries: strip("country"),
      establishmentIds: strip("est"),
      courseIds: strip("course"),
      sectionIds: strip("section"),
    });
  };

  // Marcar añade el nodo + sus ancestros; desmarcar quita solo ese nodo.
  const toggleKey = (k: string) => {
    const next = new Set(sel);
    if (next.has(k)) {
      next.delete(k);
    } else {
      next.add(k);
      for (const a of ancestorsOf(k)) next.add(a);
    }
    apply(next);
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const total = sel.size;

  const hasSomethingToFilter = !!tree && tree.length > 0 &&
    (tree.length > 1 || tree.some((c) => c.establishments.length > 1 || c.establishments.some((e) => e.courses.length > 0)));
  if (tree === null || !hasSomethingToFilter) return null;

  // Cápsulas, ordenadas país → universidad → asignatura → sección.
  const order: Level[] = ["country", "est", "course", "section"];
  const chips = [...sel].sort(
    (a, b) => order.findIndex((l) => a.startsWith(PREFIX[l])) - order.findIndex((l) => b.startsWith(PREFIX[l])),
  );

  const Check = ({ level, id }: { level: Level; id: string }) => {
    const k = key(level, id);
    return <input type="checkbox" checked={sel.has(k)} onChange={() => toggleKey(k)} className="accent-sidebar" />;
  };
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

      {/* Cápsulas independientes (País · Universidad · Asignatura · Sección) */}
      {chips.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-sidebar/10 text-sidebar border border-sidebar/30 rounded-full pl-2 pr-1 py-0.5">
          <span className="truncate max-w-[160px]">{nodeName.get(k) || k}</span>
          <button onClick={() => toggleKey(k)} className="hover:bg-sidebar/20 rounded-full p-0.5 cursor-pointer" aria-label={`Quitar ${nodeName.get(k) || ""}`}>
            <X size={11} />
          </button>
        </span>
      ))}
      {total > 1 && (
        <button onClick={() => apply(new Set())} className="text-[11px] text-gray-400 hover:text-gray-700 cursor-pointer">
          Limpiar todo
        </button>
      )}
    </div>
  );
}
