"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserCog, X } from "lucide-react";

// Filtro de rol con multi-selección (cliente). El roster ya trae a todas las
// personas; este filtro solo acota la tabla por rol y muestra los elegidos
// como etiquetas removibles.

const ROLES: { id: string; label: string }[] = [
  { id: "student", label: "Estudiante" },
  { id: "instructor", label: "Docente" },
  { id: "admin", label: "Admin" },
];

export default function RoleFilter({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = (r: string) => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  const labelOf = (r: string) => ROLES.find((x) => x.id === r)?.label || r;

  return (
    <div className="flex items-center gap-1.5 flex-wrap" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-xs h-9 px-3 rounded-lg border cursor-pointer ${
            value.length > 0 ? "bg-sidebar/10 border-sidebar/40 text-sidebar" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <UserCog size={14} />
          {value.length > 0 ? `Rol (${value.length})` : "Rol"}
          <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {open && (
          <div className="absolute z-50 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-xl p-2">
            {ROLES.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-1 px-1 rounded hover:bg-gray-50">
                <input type="checkbox" checked={value.includes(r.id)} onChange={() => toggle(r.id)} className="accent-sidebar" />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {value.map((r) => (
        <span key={r} className="inline-flex items-center gap-1 text-[11px] bg-sidebar/10 text-sidebar border border-sidebar/30 rounded-full pl-2 pr-1 py-0.5">
          {labelOf(r)}
          <button onClick={() => toggle(r)} className="hover:bg-sidebar/20 rounded-full p-0.5 cursor-pointer" aria-label={`Quitar ${labelOf(r)}`}>
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}
