"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPatientImageUrl } from "@/lib/patient-assets";

interface CatalogPatient {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  difficulty_level: string;
  country: string[] | null;
  updated_at: string;
}

interface Props {
  patients: CatalogPatient[];
  /** Solo admin/superadmin ven el nivel (pill + filtro). */
  showDifficulty?: boolean;
}

const difficulty: Record<string, { label: string; color: string }> = {
  beginner: { label: "Principiante", color: "bg-green-100 text-green-700" },
  intermediate: { label: "Intermedio", color: "bg-yellow-100 text-yellow-700" },
  advanced: { label: "Avanzado", color: "bg-red-100 text-red-700" },
};

const difficultyOrder: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

const countryFlagSrc: Record<string, string> = {
  Chile: "/flags/cl.png",
  "Perú": "/flags/pe.png",
  Colombia: "/flags/co.png",
  "México": "/flags/mx.png",
  Argentina: "/flags/ar.png",
  "República Dominicana": "/flags/do.png",
  Venezuela: "/flags/ve.png",
};

// Marcas diacríticas combinantes (U+0300–U+036F), igual que el resto del
// proyecto. Construido con RegExp para no depender de caracteres invisibles.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/\s+/g, "-");
}

function CatalogCard({ patient, showDifficulty }: { patient: CatalogPatient; showDifficulty: boolean }) {
  const slug = slugify(patient.name);
  const imageUrl = `${getPatientImageUrl(slug)}?v=${new Date(patient.updated_at).getTime()}`;
  const initials = patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const diff = difficulty[patient.difficulty_level] || difficulty.beginner;
  const flag = patient.country?.[0] ? countryFlagSrc[patient.country[0]] : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center relative hover:shadow-md transition-shadow">
      {/* Nivel — pill arriba izquierda (solo admin/superadmin) */}
      {showDifficulty && (
        <span className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full font-medium ${diff.color}`}>
          {diff.label}
        </span>
      )}

      {/* Bandera — arriba derecha */}
      {flag && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag}
          alt={patient.country?.[0] || ""}
          title={patient.country?.[0] || ""}
          className="absolute top-3 right-3 w-6 h-4 rounded-sm object-cover shadow-sm border border-gray-100"
        />
      )}

      {/* Foto fija */}
      <div className="w-24 h-24 rounded-full overflow-hidden bg-sidebar flex items-center justify-center mb-4 mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={patient.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            target.parentElement!.innerHTML = `<span class="text-white text-xl font-bold">${initials}</span>`;
          }}
        />
      </div>

      {/* Nombre + edad/rol */}
      <h3 className="text-lg font-bold text-gray-900 mb-0.5 text-center">{patient.name}</h3>
      <p className="text-sm text-gray-500 mb-4 text-center">
        {patient.age} años &middot; {patient.occupation}
      </p>

      {/* CTA — solo lectura, abre la ficha */}
      <Link
        href={`/perfiles/${patient.id}/ficha`}
        className="flex items-center justify-center gap-2 w-full bg-[#4A55A2] hover:bg-[#3D4890] text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
      >
        Conocer más del paciente
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export default function PatientCatalog({ patients, showDifficulty = false }: Props) {
  const [filterLevel, setFilterLevel] = useState("all");

  const filtered = useMemo(() => {
    const list = filterLevel === "all" ? patients : patients.filter((p) => p.difficulty_level === filterLevel);
    return [...list].sort(
      (a, b) => (difficultyOrder[a.difficulty_level] ?? 9) - (difficultyOrder[b.difficulty_level] ?? 9)
    );
  }, [patients, filterLevel]);

  return (
    <>
      {/* Filtro por nivel — solo si el rol ve el nivel */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {showDifficulty && (
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4A55A2] hover:border-gray-300 cursor-pointer"
          >
            <option value="all">Todos los niveles</option>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        )}
        <span className="text-xs text-gray-400">
          {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((p) => (
            <CatalogCard key={p.id} patient={p} showDifficulty={showDifficulty} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No hay pacientes que coincidan con los filtros.</p>
        </div>
      )}
    </>
  );
}
