"use client";

/**
 * Programar el envío de credenciales a las personas seleccionadas.
 *
 * La diferencia con el botón "Enviar ahora" no es solo la fecha: el envío
 * programado corre en el servidor, así que sobrevive a que cierres el navegador
 * y deja registro de qué pasó con cada persona. El envío inmediato sigue siendo
 * un bucle en esta pestaña, y para grupos chicos está bien porque devuelve el
 * resultado al instante.
 *
 * La vista previa llama a la MISMA función de elegibilidad que usa el worker,
 * así que el número que apruebas es el que va a ocurrir.
 */

import { useState, useEffect, useCallback } from "react";
import { CalendarClock, Users, TriangleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { chileLocalToUtcIso, formatChileDateTime, utcIsoToChileLocal } from "@/lib/datetime-cl";

interface PreviewOmitido {
  reason: string;
  label: string;
  count: number;
}

interface Preview {
  elegibles: number;
  total: number;
  fueraDeAlcance: number;
  omitidos: PreviewOmitido[];
  ventana: { firstIso: string; lastIso: string; tandas: number };
  minutosPorTanda: number;
}

interface Props {
  userIds: string[];
  onClose: () => void;
  onScheduled: () => void;
}

/** Dentro de cuántos minutos, como mínimo, se puede agendar. */
const MIN_ADELANTO_MIN = 5;

export default function ProgramarEnvioModal({ userIds, onClose, onScheduled }: Props) {
  const [label, setLabel] = useState("");
  const [cuando, setCuando] = useState(() =>
    utcIsoToChileLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
  );
  const [escalonar, setEscalonar] = useState(userIds.length > 60);
  const [perBatch, setPerBatch] = useState(50);
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [conRecordatorio, setConRecordatorio] = useState(false);
  const [recordatorioDias, setRecordatorioDias] = useState(3);
  const [customIntro, setCustomIntro] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const startsAtIso = (() => {
    try {
      return chileLocalToUtcIso(cuando);
    } catch {
      return null;
    }
  })();

  const pace = escalonar ? { perBatch, everyMinutes } : { perBatch: 0, everyMinutes: 0 };

  const cargarPreview = useCallback(async () => {
    if (!startsAtIso) return;
    setCargandoPreview(true);
    try {
      const res = await fetch("/api/admin/credential-dispatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          userIds,
          startsAt: startsAtIso,
          perBatch: pace.perBatch,
          everyMinutes: pace.everyMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo calcular la vista previa");
        return;
      }
      setPreview(data);
    } catch {
      toast.error("Error de conexión al calcular la vista previa");
    } finally {
      setCargandoPreview(false);
    }
  }, [userIds, startsAtIso, pace.perBatch, pace.everyMinutes]);

  useEffect(() => {
    const t = setTimeout(cargarPreview, 300);
    return () => clearTimeout(t);
  }, [cargarPreview]);

  const demasiadoPronto =
    !!startsAtIso && new Date(startsAtIso).getTime() < Date.now() + MIN_ADELANTO_MIN * 60_000;

  const programar = async () => {
    if (!startsAtIso) {
      toast.error("Revisa la fecha y hora");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/credential-dispatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: crypto.randomUUID(),
          label: label.trim() || null,
          userIds,
          startsAt: startsAtIso,
          perBatch: pace.perBatch,
          everyMinutes: pace.everyMinutes,
          reminderAfterDays: conRecordatorio ? recordatorioDias : null,
          customIntro: customIntro.trim() || null,
          audienceSummary: { total: userIds.length, texto: label.trim() || null },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo programar el envío");
        return;
      }
      toast.success(
        `Envío programado: ${data.programados} persona(s) para el ${formatChileDateTime(startsAtIso)}`,
      );
      onScheduled();
      onClose();
    } catch {
      toast.error("Error de conexión al programar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sidebar/10 flex items-center justify-center shrink-0">
              <CalendarClock size={22} className="text-sidebar" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Programar envío de credenciales
              </h3>
              <p className="text-xs text-gray-500">
                {userIds.length} persona(s) seleccionada(s). El envío corre en el servidor: puedes
                cerrar el navegador.
              </p>
            </div>
          </div>

          {/* Nombre del envío */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Nombre del envío (opcional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej.: UPC Psicopatología — Sección 17174"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
            <p className="text-xs text-gray-400">
              Te sirve para reconocerlo después en la lista de envíos programados.
            </p>
          </div>

          {/* Cuándo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Cuándo empieza a enviarse
            </label>
            <input
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30"
            />
            <p className="text-xs text-gray-400">
              Hora de Chile (America/Santiago), sin importar la zona horaria de tu computador.
            </p>
            {demasiadoPronto && (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <TriangleAlert size={13} />
                El despachador revisa cada 5 minutos: si eliges una hora tan cercana, puede salir
                unos minutos después.
              </p>
            )}
          </div>

          {/* Escalonado */}
          <div className="space-y-2 border border-gray-200 rounded-xl p-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={escalonar}
                onChange={(e) => setEscalonar(e.target.checked)}
                className="mt-0.5 accent-[#4A55A2]"
              />
              <span>
                <span className="text-sm font-medium text-gray-800">Enviar por tandas</span>
                <span className="block text-xs text-gray-500">
                  Reparte los correos en el tiempo. Evita que el proveedor los marque como envío
                  masivo y escalona la entrada de gente a la plataforma.
                </span>
              </span>
            </label>
            {escalonar && (
              <div className="flex flex-wrap items-center gap-2 pl-7 pt-1 text-sm text-gray-700">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={perBatch}
                  onChange={(e) => setPerBatch(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                />
                <span>correos cada</span>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={everyMinutes}
                  onChange={(e) => setEveryMinutes(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                />
                <span>minutos</span>
              </div>
            )}
          </div>

          {/* Recordatorio */}
          <div className="space-y-2 border border-gray-200 rounded-xl p-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={conRecordatorio}
                onChange={(e) => setConRecordatorio(e.target.checked)}
                className="mt-0.5 accent-[#4A55A2]"
              />
              <span>
                <span className="text-sm font-medium text-gray-800">
                  Reenviar a quienes no hayan ingresado
                </span>
                <span className="block text-xs text-gray-500">
                  Solo a quien no usó sus credenciales. Recibe una contraseña nueva y el correo se
                  lo dice: la anterior deja de funcionar.
                </span>
              </span>
            </label>
            {conRecordatorio && (
              <div className="flex items-center gap-2 pl-7 pt-1 text-sm text-gray-700">
                <span>Después de</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={recordatorioDias}
                  onChange={(e) => setRecordatorioDias(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                />
                <span>día(s)</span>
              </div>
            )}
          </div>

          {/* Mensaje adicional */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Mensaje adicional (opcional)
            </label>
            <textarea
              value={customIntro}
              onChange={(e) => setCustomIntro(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Se agrega al correo, antes de las credenciales. Por ejemplo: la fecha de la primera clase."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar/30 resize-y"
            />
          </div>

          {/* Vista previa */}
          <div className="border border-sidebar/20 bg-sidebar/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-sidebar">
              <Users size={15} />
              Qué va a pasar
              {cargandoPreview && <Loader2 size={13} className="animate-spin" />}
            </div>
            {preview ? (
              <div className="space-y-1.5 text-sm text-gray-700">
                <p>
                  <strong>{preview.elegibles}</strong> de {preview.total} recibirán el correo.
                </p>
                {preview.ventana.tandas > 1 ? (
                  <p className="text-xs text-gray-600">
                    En {preview.ventana.tandas} tandas, desde el{" "}
                    {formatChileDateTime(preview.ventana.firstIso)} hasta aproximadamente el{" "}
                    {formatChileDateTime(preview.ventana.lastIso)}.
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">
                    A partir del {formatChileDateTime(preview.ventana.firstIso)}, tomará unos{" "}
                    {Math.max(1, preview.minutosPorTanda)} minuto(s) en completarse.
                  </p>
                )}
                {preview.omitidos.length > 0 && (
                  <ul className="pt-1 space-y-0.5">
                    {preview.omitidos.map((o) => (
                      <li key={o.reason} className="text-xs text-gray-500">
                        {o.count} quedará(n) fuera — {o.label.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                )}
                {preview.fueraDeAlcance > 0 && (
                  <p className="text-xs text-amber-700">
                    {preview.fueraDeAlcance} está(n) fuera de tu alcance y no se incluirán.
                  </p>
                )}
                <p className="text-xs text-gray-400 pt-1">
                  Es una estimación: si alguien ingresa a la plataforma antes de la fecha, se le
                  omitirá automáticamente para no romperle la contraseña que haya elegido.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Calculando…</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={programar}
              disabled={guardando || !startsAtIso || (preview?.elegibles ?? 0) === 0}
              className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {guardando && <Loader2 size={15} className="animate-spin" />}
              {preview ? `Programar para ${preview.elegibles}` : "Programar"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
