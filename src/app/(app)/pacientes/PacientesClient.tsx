"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import PatientCard from "@/components/PatientCard";

interface Patient {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  quote: string;
  difficulty_level: string;
  tags: string[] | null;
  country: string[] | null;
  voice_id: string | null;
}

interface Props {
  patients: Patient[];
  activeSessionMap: Record<string, string>;
}

const difficultyOrder: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const difficultyLabels: Record<string, string> = {
  all: "Todos los niveles",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const countryFlagSrc: Record<string, string> = {
  "Chile": "/flags/cl.png",
  "Perú": "/flags/pe.png",
  "Colombia": "/flags/co.png",
  "México": "/flags/mx.png",
  "Argentina": "/flags/ar.png",
  "República Dominicana": "/flags/do.png",
  "Venezuela": "/flags/ve.png",
};

export default function PacientesClient({ patients, activeSessionMap }: Props) {
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [filterLevel, setFilterLevel] = useState("all");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const countries = useMemo(() => {
    const set = new Set<string>();
    patients.forEach(p => (p.country || []).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [patients]);

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = patients;

    if (selectedCountries.size > 0) {
      list = list.filter(p => (p.country || []).some(c => selectedCountries.has(c)));
    }

    if (filterLevel !== "all") {
      list = list.filter(p => p.difficulty_level === filterLevel);
    }

    return [...list].sort((a, b) => {
      const aActive = activeSessionMap[a.id] ? 0 : 1;
      const bActive = activeSessionMap[b.id] ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (difficultyOrder[a.difficulty_level] ?? 9) - (difficultyOrder[b.difficulty_level] ?? 9);
    });
  }, [patients, selectedCountries, filterLevel, activeSessionMap]);

  const countryLabel = selectedCountries.size === 0
    ? "Todos los países"
    : selectedCountries.size === 1
      ? Array.from(selectedCountries)[0]
      : `${selectedCountries.size} países`;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Country multi-select dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
            className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors min-w-[180px]"
          >
            {selectedCountries.size === 1 && countryFlagSrc[Array.from(selectedCountries)[0]] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={countryFlagSrc[Array.from(selectedCountries)[0]]}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
            )}
            <span className="flex-1 text-left">{countryLabel}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${countryDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {countryDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {/* Clear all */}
              {selectedCountries.size > 0 && (
                <button
                  onClick={() => setSelectedCountries(new Set())}
                  className="w-full text-left px-4 py-2 text-xs text-sidebar hover:bg-gray-50 border-b border-gray-100"
                >
                  Limpiar filtro
                </button>
              )}
              {countries.map(c => {
                const isSelected = selectedCountries.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCountry(c)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-sidebar/5 font-medium" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-sidebar border-sidebar" : "border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {/* Name */}
                    <span className="flex-1 text-left text-gray-700">{c}</span>
                    {/* Flag */}
                    {countryFlagSrc[c] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={countryFlagSrc[c]} alt={c} className="w-5 h-5 rounded-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Level filter */}
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-sidebar"
        >
          {Object.entries(difficultyLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Result count */}
        <span className="text-xs text-gray-400">
          {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((patient) => (
            <PatientCard
              key={patient.id}
              id={patient.id}
              name={patient.name}
              age={patient.age}
              occupation={patient.occupation}
              quote={patient.quote}
              difficultyLevel={patient.difficulty_level}
              tags={patient.tags || undefined}
              activeConversationId={activeSessionMap[patient.id]}
              country={patient.country?.[0] || null}
              hasVoice={!!patient.voice_id}
            />
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
