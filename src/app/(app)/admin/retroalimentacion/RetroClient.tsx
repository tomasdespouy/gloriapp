"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

type Survey = { id: string; title: string; scope_type: string; scope_id: string | null; starts_at: string; ends_at: string; is_active: boolean; created_at: string };
type Response = { id: string; survey_id: string; nps_score: number; positives: string | null; improvements: string | null; comments: string | null; created_at: string; userName: string; establishmentId: string | null; courseId: string | null; sectionId: string | null };
type Est = { id: string; name: string; country: string | null };
type Course = { id: string; name: string; establishment_id: string };
type Section = { id: string; name: string; course_id: string };

type Props = {
  surveys: Survey[];
  responses: Response[];
  establishments: Est[];
  courses: Course[];
  sections: Section[];
  nps: number;
  totalResponses: number;
  isSuperadmin: boolean;
};

const NPS_EMOJIS = ["😡", "😠", "😤", "😕", "😐", "🙂", "😊", "😃", "😄", "🤩", "🌟"];

export default function RetroClient({ surveys, responses, establishments, courses, sections }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "surveys" | "create">("overview");
  const [yearFilter, setYearFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [estFilter, setEstFilter] = useState("");

  // Filter responses
  const filtered = responses.filter(r => {
    if (yearFilter && !r.created_at.startsWith(yearFilter)) return false;
    if (estFilter && r.establishmentId !== estFilter) return false;
    if (countryFilter) {
      const est = establishments.find(e => e.id === r.establishmentId);
      if (est?.country !== countryFilter) return false;
    }
    return true;
  });

  const filteredScores = filtered.map(r => r.nps_score);
  const fPromoters = filteredScores.filter(s => s >= 9).length;
  const fDetractors = filteredScores.filter(s => s <= 6).length;
  const fNps = filteredScores.length > 0 ? Math.round(((fPromoters - fDetractors) / filteredScores.length) * 100) : 0;
  const fAvg = filteredScores.length > 0 ? (filteredScores.reduce((a, b) => a + b, 0) / filteredScores.length).toFixed(1) : "—";

  const countries = [...new Set(establishments.map(e => e.country).filter(Boolean))] as string[];
  const years = [...new Set(responses.map(r => r.created_at.slice(0, 4)))].sort().reverse();

  return (
    <div className="min-h-screen">
      <header className="px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Retroalimentación</h1>
        <p className="text-sm text-gray-500 mt-0.5">Encuestas NPS y satisfacción de usuarios</p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-8 mb-6">
        {[
          { key: "overview", label: "Consolidado" },
          { key: "surveys", label: "Encuestas" },
          { key: "create", label: "Crear encuesta" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`tab-btn px-5 py-3 text-sm font-medium border-b-2 ${tab === t.key ? "border-sidebar text-sidebar" : "border-transparent text-gray-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-8 pb-8">
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                <option value="">Todos los años</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                <option value="">Todos los países</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={estFilter} onChange={e => setEstFilter(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                <option value="">Todas las instituciones</option>
                {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* NPS cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <p className={`text-4xl font-bold ${fNps >= 50 ? "text-green-600" : fNps >= 0 ? "text-amber-600" : "text-red-600"}`}>{fNps}</p>
                <p className="text-xs text-gray-400 mt-1">NPS Score</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <p className="text-4xl font-bold text-gray-900">{fAvg}</p>
                <p className="text-xs text-gray-400 mt-1">Promedio (0-10)</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <p className="text-4xl font-bold text-sidebar">{filteredScores.length}</p>
                <p className="text-xs text-gray-400 mt-1">Respuestas</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <div className="flex justify-center gap-1 mb-1">
                  <span className="text-xs text-green-600 font-medium">{fPromoters} promotores</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-red-600 font-medium">{fDetractors} detractores</span>
                </div>
                <p className="text-xs text-gray-400">Distribución</p>
              </div>
            </div>

            {/* Score distribution */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Distribución de puntajes</h3>
              <div className="flex items-end gap-2 h-32">
                {Array.from({ length: 11 }, (_, i) => {
                  const count = filteredScores.filter(s => s === i).length;
                  const max = Math.max(...Array.from({ length: 11 }, (_, j) => filteredScores.filter(s => s === j).length), 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-400 font-medium">{count}</span>
                      <div className={`w-full rounded-t ${i <= 6 ? "bg-red-400" : i <= 8 ? "bg-amber-400" : "bg-green-400"}`}
                        style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
                      <span className="text-lg">{NPS_EMOJIS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent responses */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Respuestas recientes</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {filtered.slice(0, 20).map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{NPS_EMOJIS[r.nps_score]}</span>
                        <span className="text-sm font-medium text-gray-900">{r.userName}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                    </div>
                    {r.positives && <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mb-1"><strong>Positivo:</strong> {r.positives}</p>}
                    {r.improvements && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1"><strong>Mejorar:</strong> {r.improvements}</p>}
                    {r.comments && <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1"><strong>Comentario:</strong> {r.comments}</p>}
                  </div>
                ))}
                {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Sin respuestas</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "surveys" && (
          <div className="space-y-3">
            {surveys.map(s => {
              const respCount = responses.filter(r => r.survey_id === s.id).length;
              const isLive = s.is_active && new Date(s.starts_at) <= new Date() && new Date(s.ends_at) >= new Date();
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                      {isLive && <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase">Activa</span>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {s.scope_type === "global" ? "Global" : s.scope_type} · {new Date(s.starts_at).toLocaleDateString("es-CL")} — {new Date(s.ends_at).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-sidebar">{respCount}</p>
                    <p className="text-[10px] text-gray-400">respuestas</p>
                  </div>
                </div>
              );
            })}
            {surveys.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No hay encuestas creadas</p>}
          </div>
        )}

        {tab === "create" && <CreateSurveyForm establishments={establishments} courses={courses} sections={sections} countries={countries} onCreated={() => { setTab("surveys"); router.refresh(); }} />}
      </div>
    </div>
  );
}

const INITIAL_START_DATE = new Date().toISOString().slice(0, 10);
const INITIAL_END_DATE = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

function CreateSurveyForm({ establishments, courses, sections, countries, onCreated }: {
  establishments: Est[]; courses: Course[]; sections: Section[]; countries: string[]; onCreated: () => void;
}) {
  const [title, setTitle] = useState("Encuesta de satisfacción GlorIA");
  const [scopeType, setScopeType] = useState("global");
  const [scopeId, setScopeId] = useState("");
  const [startsAt, setStartsAt] = useState(INITIAL_START_DATE);
  const [endsAt, setEndsAt] = useState(INITIAL_END_DATE);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    await fetch("/api/admin/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        scope_type: scopeType,
        scope_id: scopeType !== "global" ? scopeId : null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt + "T23:59:59").toISOString(),
      }),
    });
    setLoading(false);
    onCreated();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Crear nueva encuesta</h3>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Alcance</label>
          <select value={scopeType} onChange={e => { setScopeType(e.target.value); setScopeId(""); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="global">Global (todos los usuarios)</option>
            <option value="country">Por país</option>
            <option value="establishment">Por institución</option>
            <option value="course">Por asignatura</option>
            <option value="section">Por sección</option>
          </select>
        </div>

        {scopeType !== "global" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {scopeType === "country" ? "País" : scopeType === "establishment" ? "Institución" : scopeType === "course" ? "Asignatura" : "Sección"}
            </label>
            <select value={scopeId} onChange={e => setScopeId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar</option>
              {scopeType === "country" && countries.map(c => <option key={c} value={c}>{c}</option>)}
              {scopeType === "establishment" && establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              {scopeType === "course" && courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              {scopeType === "section" && sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
          <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha cierre</label>
          <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <button onClick={handleCreate} disabled={loading || !title.trim()}
        className="flex items-center gap-2 bg-sidebar text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-sidebar-hover disabled:opacity-50">
        <Send size={16} /> {loading ? "Creando..." : "Crear y activar encuesta"}
      </button>
    </div>
  );
}
