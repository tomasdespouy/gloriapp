"use client";

/**
 * INF-2026-050: editor de los 4 bloques de enriquecimiento del paciente.
 * Por bloque: textarea grande, botón "Generar borrador con IA", botón "Guardar".
 * Cada acción de Guardar incrementa enrichment_version y registra en enrichment_history.
 */
import { useState } from "react";
import { Sparkles, Save, Loader2, CheckCircle2 } from "lucide-react";

export interface EnrichmentBlock {
  text?: string;
  version?: number;
  generated_by?: "ai" | "human";
  generated_at?: string;
  model?: string;
}

interface Props {
  patientId: string;
  initial: {
    red_social: EnrichmentBlock | null;
    lugares: EnrichmentBlock | null;
    estado_corporal: EnrichmentBlock | null;
    frases_tipo: EnrichmentBlock | null;
  };
  enrichmentVersion: number;
}

const BLOCKS: { key: keyof Props["initial"]; title: string; hint: string; placeholder: string }[] = [
  {
    key: "red_social",
    title: "RED SOCIAL Y VÍNCULOS",
    hint: "Personajes secundarios con nombre, edad, rol y micro-historia (familia + 1-3 personas del círculo cotidiano).",
    placeholder: "RED SOCIAL Y VÍNCULOS:\n- Tu mamá Patricia (45) trabaja en una farmacia...\n- Tu hermana Valentina (14) está en octavo básico...\n- Cristóbal (compañero de tu sección) te invitó a un grupo de estudio...",
  },
  {
    key: "lugares",
    title: "LUGARES SIGNIFICATIVOS",
    hint: "3-5 lugares físicos del día a día con detalle sensorial específico.",
    placeholder: "LUGARES SIGNIFICATIVOS:\n- Tu pieza en la residencia universitaria: pequeña, desordenada...\n- La biblioteca del campus: vas al segundo piso...\n- El parque a una cuadra de la residencia...",
  },
  {
    key: "estado_corporal",
    title: "ESTADO CORPORAL Y RUTINA",
    hint: "Sueño, apetito, vestimenta, energía. Coherente con el motivo de consulta.",
    placeholder: "ESTADO CORPORAL Y RUTINA:\n- Sueño irregular: a veces no puedes dormir hasta las 3 AM...\n- Comes mal y a deshora...\n- Llevas la misma polera dos o tres días seguidos...",
  },
  {
    key: "frases_tipo",
    title: "FRASES TIPO QUE DICES",
    hint: "6-8 frases breves entre comillas, en dialecto del país. Anclas tonales del paciente.",
    placeholder: 'FRASES TIPO QUE DICES:\n- "No sé... como que todos cachan todo y yo no entiendo nada."\n- "Igual no es tan grave. Hay gente peor."\n- "Mi mamá cree que estoy bien. Es mejor así."',
  },
];

export default function EnrichmentEditor({ patientId, initial, enrichmentVersion }: Props) {
  const [blocks, setBlocks] = useState<Record<string, string>>({
    red_social: initial.red_social?.text || "",
    lugares: initial.lugares?.text || "",
    estado_corporal: initial.estado_corporal?.text || "",
    frases_tipo: initial.frases_tipo?.text || "",
  });
  const [meta, setMeta] = useState<Record<string, EnrichmentBlock | null>>({
    red_social: initial.red_social,
    lugares: initial.lugares,
    estado_corporal: initial.estado_corporal,
    frases_tipo: initial.frases_tipo,
  });
  const [loading, setLoading] = useState<Record<string, "gen" | "save" | null>>({});
  const [messages, setMessages] = useState<Record<string, { type: "ok" | "err"; text: string } | null>>({});

  const setLoadingFor = (key: string, value: "gen" | "save" | null) =>
    setLoading((prev) => ({ ...prev, [key]: value }));
  const setMessageFor = (key: string, msg: { type: "ok" | "err"; text: string } | null) =>
    setMessages((prev) => ({ ...prev, [key]: msg }));

  const generate = async (key: string) => {
    setLoadingFor(key, "gen");
    setMessageFor(key, null);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/enrich/${key}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");
      setBlocks((prev) => ({ ...prev, [key]: data.block.text }));
      setMessageFor(key, { type: "ok", text: "Borrador generado. Revisa antes de guardar." });
    } catch (e) {
      setMessageFor(key, { type: "err", text: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoadingFor(key, null);
    }
  };

  const save = async (key: string) => {
    const text = (blocks[key] || "").trim();
    if (text.length < 30) {
      setMessageFor(key, { type: "err", text: "El bloque debe tener al menos 30 caracteres" });
      return;
    }
    setLoadingFor(key, "save");
    setMessageFor(key, null);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/enrich/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, generated_by: "human" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMeta((prev) => ({ ...prev, [key]: data.block }));
      setMessageFor(key, { type: "ok", text: `Guardado · versión ${data.version}` });
    } catch (e) {
      setMessageFor(key, { type: "err", text: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoadingFor(key, null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">Enriquecimiento del prompt (INF-2026-050)</h3>
        <span className="text-[11px] text-gray-400">
          {enrichmentVersion === 0 ? "Sin enriquecer" : `Versión ${enrichmentVersion}`}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        4 bloques opcionales que se inyectan al system_prompt en runtime sin modificar la columna base.
        Cada Guardar incrementa la versión y registra en <code>enrichment_history</code>.
      </p>

      <div className="space-y-5">
        {BLOCKS.map(({ key, title, hint, placeholder }) => {
          const m = meta[key];
          const msg = messages[key];
          const isGen = loading[key] === "gen";
          const isSave = loading[key] === "save";
          const isAnyLoading = isGen || isSave;

          return (
            <div key={key} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-semibold text-gray-800 block">{title}</label>
                  <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
                </div>
                {m?.text && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle2 size={11} /> v{m.version} · {m.generated_by}
                  </span>
                )}
              </div>
              <textarea
                value={blocks[key]}
                onChange={(e) => setBlocks((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={8}
                disabled={isAnyLoading}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed disabled:bg-gray-50"
              />
              <div className="flex items-center justify-between mt-2 gap-2">
                <button
                  type="button"
                  onClick={() => generate(key)}
                  disabled={isAnyLoading}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {isGen ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {isGen ? "Generando..." : "Generar borrador con IA"}
                </button>
                <button
                  type="button"
                  onClick={() => save(key)}
                  disabled={isAnyLoading || (blocks[key] || "").trim().length < 30}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sidebar text-white hover:bg-sidebar/90 disabled:opacity-50"
                >
                  {isSave ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {isSave ? "Guardando..." : "Guardar bloque"}
                </button>
              </div>
              {msg && (
                <div
                  className={`text-[11px] mt-2 ${
                    msg.type === "err" ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {msg.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
