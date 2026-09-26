"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, UserPlus, Trash2, Loader2 } from "lucide-react";
import { chileLocalToUtcIso, utcIsoToChileLocal } from "@/lib/datetime-cl";

type Pilot = {
  id: string;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  model: string;
  budget_usd: number;
  retention_days: number;
  max_duration_seconds: number;
  ai_patients: { id: string; name: string; base_patient_id: string | null; is_active: boolean } | null;
};
type AccessRow = { id: string; pilot_id: string; user_id: string; can_participate: boolean; can_review_own: boolean; expires_at: string | null; revoked_at: string | null };
type GrantRow = { id: string; pilot_id: string; user_id: string; attempt_number: number; consumed_by: string | null };
type UserRow = { id: string; full_name: string | null; email: string };

interface Props {
  pilots: Pilot[];
  accessRows: AccessRow[];
  grantRows: GrantRow[];
  users: UserRow[];
}

export default function VoicePilotsClient({ pilots, accessRows, grantRows, users }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<Record<string, string>>({});

  const userMap = new Map(users.map((u) => [u.id, u]));

  const patchPilot = async (pilotId: string, updates: Record<string, unknown>) => {
    setSaving(pilotId);
    try {
      const res = await fetch(`/api/admin/voice-pilots/${pilotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Error del servidor");
      }
      toast.success("Guardado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(null);
    }
  };

  const addAccess = async (pilotId: string) => {
    const email = (emailDraft[pilotId] || "").trim();
    if (!email) return;
    setSaving(pilotId);
    try {
      const res = await fetch(`/api/admin/voice-pilots/${pilotId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Error del servidor");
      }
      toast.success("Participante incorporado, con su primer cupo");
      setEmailDraft((p) => ({ ...p, [pilotId]: "" }));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo incorporar");
    } finally {
      setSaving(null);
    }
  };

  const revokeAccess = async (pilotId: string, userId: string) => {
    if (!confirm("¿Revocar acceso? La persona no podrá iniciar ni reconectar más intentos.")) return;
    setSaving(pilotId);
    try {
      const res = await fetch(`/api/admin/voice-pilots/${pilotId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", userId }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      toast.success("Acceso revocado");
      router.refresh();
    } catch {
      toast.error("No se pudo revocar");
    } finally {
      setSaving(null);
    }
  };

  const grantAnother = async (pilotId: string, userId: string) => {
    setSaving(pilotId);
    try {
      const res = await fetch(`/api/admin/voice-pilots/${pilotId}/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: "Nuevo intento concedido desde admin" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Error del servidor");
      }
      toast.success("Nuevo intento concedido");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo conceder");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="px-4 sm:px-8 py-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mic size={22} className="text-sidebar" /> Piloto de voz
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Etapa 1 — aislamiento y permisos. Sin conexión de voz real todavía: apagado por default.
        </p>
      </header>

      <div className="px-4 sm:px-8 pb-8 space-y-4">
        {pilots.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No hay ningún piloto de voz configurado todavía.
          </div>
        )}

        {pilots.map((pilot) => {
          const access = accessRows.filter((a) => a.pilot_id === pilot.id);
          const grants = grantRows.filter((g) => g.pilot_id === pilot.id);
          const isSaving = saving === pilot.id;

          return (
            <div key={pilot.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {pilot.ai_patients?.name || "Paciente desconocido"}
                    {pilot.ai_patients && !pilot.ai_patients.is_active && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactivo</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400">{pilot.model} &middot; máx {Math.round(pilot.max_duration_seconds / 60)} min &middot; US${pilot.budget_usd.toFixed(2)}/intento &middot; retención {pilot.retention_days}d</p>
                </div>
                <div className="flex items-center gap-4">
                  {pilot.ai_patients && (
                    <Link
                      href={`/piloto-voz/${pilot.ai_patients.id}`}
                      className="text-xs font-medium text-[#4A55A2] underline"
                    >
                      Probar voz →
                    </Link>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pilot.enabled}
                      disabled={isSaving}
                      onChange={(e) => patchPilot(pilot.id, { enabled: e.target.checked })}
                      className="cursor-pointer"
                    />
                    Habilitado
                    {isSaving && <Loader2 size={12} className="animate-spin text-gray-400" />}
                  </label>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-600 bg-gray-50">
                <label className="flex items-center gap-2">
                  Desde:
                  <input
                    type="datetime-local"
                    defaultValue={pilot.starts_at ? utcIsoToChileLocal(pilot.starts_at) : ""}
                    onBlur={(e) => {
                      if (!e.target.value) return;
                      patchPilot(pilot.id, { starts_at: chileLocalToUtcIso(e.target.value) });
                    }}
                    className="border border-gray-200 rounded px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Hasta:
                  <input
                    type="datetime-local"
                    defaultValue={pilot.ends_at ? utcIsoToChileLocal(pilot.ends_at) : ""}
                    onBlur={(e) => {
                      if (!e.target.value) return;
                      patchPilot(pilot.id, { ends_at: chileLocalToUtcIso(e.target.value) });
                    }}
                    className="border border-gray-200 rounded px-2 py-1"
                  />
                </label>
                {(!pilot.starts_at || !pilot.ends_at) && (
                  <span className="text-amber-600">Sin ambas fechas, nadie puede iniciar un intento (fail-closed).</span>
                )}
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Participantes ({access.length})
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      placeholder="correo de una cuenta existente..."
                      value={emailDraft[pilot.id] || ""}
                      onChange={(e) => setEmailDraft((p) => ({ ...p, [pilot.id]: e.target.value }))}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-64"
                    />
                    <button
                      onClick={() => addAccess(pilot.id)}
                      disabled={isSaving || !emailDraft[pilot.id]?.trim()}
                      className="flex items-center gap-1.5 bg-sidebar text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-sidebar-hover disabled:opacity-50 cursor-pointer"
                    >
                      <UserPlus size={13} /> Incorporar
                    </button>
                  </div>
                </div>

                {access.length === 0 ? (
                  <p className="text-xs text-gray-400">Nadie tiene acceso todavía.</p>
                ) : (
                  <div className="space-y-1.5">
                    {access.map((a) => {
                      const u = userMap.get(a.user_id);
                      const userGrants = grants.filter((g) => g.user_id === a.user_id);
                      const usedCount = userGrants.filter((g) => g.consumed_by).length;
                      const revoked = !!a.revoked_at;
                      return (
                        <div key={a.id} className={`flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm ${revoked ? "opacity-50" : ""}`}>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{u?.full_name || u?.email || a.user_id}</p>
                            <p className="text-[11px] text-gray-400">
                              {usedCount}/{userGrants.length} intentos usados
                              {revoked && " · revocado"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!revoked && (
                              <button
                                onClick={() => grantAnother(pilot.id, a.user_id)}
                                disabled={isSaving}
                                className="text-xs text-sidebar hover:underline cursor-pointer disabled:opacity-50"
                              >
                                Conceder otro intento
                              </button>
                            )}
                            {!revoked && (
                              <button
                                onClick={() => revokeAccess(pilot.id, a.user_id)}
                                disabled={isSaving}
                                className="text-gray-300 hover:text-red-500 p-1 rounded cursor-pointer disabled:opacity-50"
                                title="Revocar acceso"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
