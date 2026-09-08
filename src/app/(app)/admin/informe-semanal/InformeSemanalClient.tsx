"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Trash2, Send, Eye, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Establecimiento = { id: string; name: string };
type Suscripcion = { id: string; establishment_id: string; email: string; full_name: string | null; is_active: boolean };
type Corrida = {
  id: string; establishment_id: string; period_key: string; status: string;
  recipients: number; sent_count: number; failed_count: number; note: string | null;
  triggered_by: string; started_at: string; finished_at: string | null;
};
type Entrega = {
  run_id: string; email: string; success: boolean; error: string | null;
  sent_at: string; delivery_status: string | null; delivery_at: string | null;
};

const TZ = "America/Santiago";
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Estado de entrega. "Enviado" y "entregado" son cosas distintas y se muestran
 * distinto a propósito: un correo aceptado por Resend puede rebotar minutos
 * después. Mientras el webhook no esté configurado, todo lo enviado queda como
 * "sin confirmar" en vez de dar por bueno algo que no sabemos.
 */
function estadoEntrega(e: Entrega, seguimiento: boolean) {
  if (!e.success) return { txt: "falló el envío", cls: "text-red-600 bg-red-50", icon: XCircle };
  if (e.delivery_status === "delivered") return { txt: "entregado", cls: "text-emerald-700 bg-emerald-50", icon: CheckCircle };
  if (e.delivery_status === "bounced") return { txt: "rebotó", cls: "text-red-600 bg-red-50", icon: XCircle };
  if (e.delivery_status === "complained") return { txt: "marcado como spam", cls: "text-amber-700 bg-amber-50", icon: AlertTriangle };
  if (e.delivery_status === "opened") return { txt: "abierto", cls: "text-emerald-700 bg-emerald-50", icon: CheckCircle };
  return seguimiento
    ? { txt: "enviado, sin confirmar", cls: "text-gray-500 bg-gray-100", icon: Clock }
    : { txt: "enviado", cls: "text-gray-500 bg-gray-100", icon: Clock };
}

export default function InformeSemanalClient({
  establecimientos, suscripciones, corridas, entregas, seguimientoEntrega,
}: {
  establecimientos: Establecimiento[];
  suscripciones: Suscripcion[];
  corridas: Corrida[];
  entregas: Entrega[];
  seguimientoEntrega: boolean;
}) {
  const router = useRouter();
  const [estId, setEstId] = useState(establecimientos[0]?.id || "");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Record<string, unknown>[] | null>(null);

  const nombreEst = new Map(establecimientos.map((e) => [e.id, e.name]));
  const delEst = suscripciones.filter((s) => s.establishment_id === estId);

  const llamar = async (metodo: string, cuerpo: Record<string, unknown>) => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/informe-semanal", {
        method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || `Error ${res.status}`);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
      return false;
    } finally {
      setCargando(false);
    }
  };

  const agregar = async () => {
    if (!nuevoEmail.trim()) return;
    const ok = await llamar("POST", { establishment_id: estId, email: nuevoEmail.trim(), full_name: nuevoNombre.trim() || null });
    if (ok) { setNuevoEmail(""); setNuevoNombre(""); toast.success("Suscriptor agregado"); }
  };

  const disparar = async (dry: boolean) => {
    setCargando(true);
    setPrevia(null);
    try {
      const res = await fetch("/api/admin/informe-semanal/enviar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dry }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || `Error ${res.status}`);
      if (dry) {
        setPrevia((d?.resumen || []) as Record<string, unknown>[]);
        toast.success("Vista previa generada. No se envió nada.");
      } else {
        toast.success("Envío ejecutado");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ejecutar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Informe semanal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Se envía los lunes a las 7:00 de Chile. Quién lo recibe, qué salió y qué llegó.
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* ── Lista de distribución ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-sidebar" />
            <h2 className="text-sm font-semibold text-gray-900">Lista de distribución</h2>
          </div>

          <select
            value={estId}
            onChange={(e) => setEstId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer"
          >
            {establecimientos.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <div className="space-y-2">
            {delEst.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3">
                Esta institución no tiene suscriptores: no se le envía nada.
              </p>
            )}
            {delEst.map((s) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${s.is_active ? "border-gray-100" : "border-gray-100 bg-gray-50"}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate ${s.is_active ? "text-gray-900" : "text-gray-400 line-through"}`}>{s.email}</p>
                  {s.full_name && <p className="text-[10px] text-gray-400 truncate">{s.full_name}</p>}
                </div>
                <button
                  onClick={() => llamar("PATCH", { id: s.id, is_active: !s.is_active })}
                  disabled={cargando}
                  className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  {s.is_active ? "Pausar" : "Activar"}
                </button>
                <button
                  onClick={() => { if (confirm(`¿Quitar a ${s.email} de la lista?`)) llamar("DELETE", { id: s.id }); }}
                  disabled={cargando}
                  className="text-gray-300 hover:text-red-500 p-1 rounded cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <input
              value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
              placeholder="correo@institucion.cl"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre (opcional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={agregar} disabled={cargando || !nuevoEmail.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-sidebar text-white rounded-lg py-2 text-sm font-medium hover:bg-sidebar-hover cursor-pointer disabled:opacity-40"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <button
              onClick={() => disparar(true)} disabled={cargando}
              className="w-full flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40"
            >
              <Eye size={14} /> Vista previa (no envía)
            </button>
            <button
              onClick={() => { if (confirm("Esto envía el informe AHORA a todas las listas activas. ¿Continuar?")) disparar(false); }}
              disabled={cargando}
              className="w-full flex items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-800 rounded-lg py-2 text-sm font-medium hover:bg-amber-100 cursor-pointer disabled:opacity-40"
            >
              <Send size={14} /> Enviar ahora
            </button>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Enviar ahora no duplica: si el informe de esta semana ya salió, la corrida se
              salta sola.
            </p>
          </div>
        </div>

        {/* ── Corridas ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!seguimientoEntrega && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Falta configurar el seguimiento de entrega.</strong> Sin el webhook de
                Resend sabemos qué salió, no qué llegó: un correo que rebota se ve igual que uno
                entregado. Se configura una vez en Resend (Webhooks → {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/resend)
                y copiando el secreto a RESEND_WEBHOOK_SECRET.
              </p>
            </div>
          )}

          {previa && (
            <div className="bg-white rounded-xl border border-sidebar/30 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">Vista previa — no se envió nada</p>
              {previa.length === 0 && <p className="text-xs text-gray-400">Ninguna institución tiene suscriptores activos.</p>}
              {previa.map((r, i) => (
                <div key={i} className="text-xs text-gray-600 border-t border-gray-50 py-2">
                  <p className="font-medium text-gray-900">{String(r.establecimiento ?? r.establishmentId ?? "")}</p>
                  {r.titular ? <p className="mt-0.5">{String(r.titular)}</p> : null}
                  <p className="text-gray-400 mt-0.5">
                    {r.destinatarios != null ? `${r.destinatarios} destinatarios · ` : ""}
                    {r.kb != null ? `${r.kb} KB` : ""}
                    {r.motivo ? `saltado: ${r.motivo}` : ""}
                    {r.error ? `error: ${String(r.error)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Envíos</h2>
            {corridas.length === 0 && (
              <p className="text-xs text-gray-400 italic py-4 text-center">
                Todavía no hay envíos. El primero sale el lunes a las 7:00.
              </p>
            )}
            <div className="space-y-2">
              {corridas.map((c) => {
                const suyas = entregas.filter((e) => e.run_id === c.id);
                const abierto = abierta === c.id;
                const badge =
                  c.status === "sent" ? "bg-emerald-50 text-emerald-700"
                  : c.status === "failed" ? "bg-red-50 text-red-600"
                  : c.status === "skipped" ? "bg-gray-100 text-gray-500"
                  : "bg-amber-50 text-amber-700";
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg">
                    <button
                      onClick={() => setAbierta(abierto ? null : c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {nombreEst.get(c.establishment_id) || "—"}
                          <span className="text-xs text-gray-400 font-normal ml-2">{c.period_key}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {fecha(c.started_at)} · {c.triggered_by === "cron" ? "automático" : "manual"}
                          {c.note ? ` · ${c.note}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge}`}>
                        {c.sent_count}/{c.recipients} enviados
                        {c.failed_count > 0 ? ` · ${c.failed_count} con error` : ""}
                      </span>
                    </button>
                    {abierto && (
                      <div className="border-t border-gray-100 px-4 py-2 space-y-1 bg-gray-50/50">
                        {suyas.length === 0 && <p className="text-[11px] text-gray-400 py-1">Sin detalle de destinatarios.</p>}
                        {suyas.map((e, i) => {
                          const st = estadoEntrega(e, seguimientoEntrega);
                          const Icono = st.icon;
                          return (
                            <div key={i} className="flex items-center gap-2 py-1">
                              <Icono size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="text-[11px] text-gray-700 flex-1 truncate">{e.email}</span>
                              {e.error && <span className="text-[10px] text-red-500 truncate max-w-[180px]" title={e.error}>{e.error}</span>}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.cls}`}>{st.txt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
