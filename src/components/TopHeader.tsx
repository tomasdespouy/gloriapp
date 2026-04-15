"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, User, LogOut, ChevronDown, LifeBuoy, BarChart3, Info, Eye, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { setImpersonation, clearImpersonation } from "@/lib/actions/impersonate";
import AccessibilityButton, { type A11yPrefs } from "@/components/AccessibilityButton";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  realRole: string;
  avatarUrl?: string | null;
  isImpersonating: boolean;
  impersonationLabel?: string;
  establishments?: { id: string; name: string }[];
  a11yPrefs?: A11yPrefs | null;
}

export default function TopHeader({ userName, userEmail, userRole, realRole, avatarUrl, isImpersonating, impersonationLabel, establishments, a11yPrefs }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportBody, setSupportBody] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [clickedNotifId, setClickedNotifId] = useState<string | null>(null);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    const res = await fetch(`/api/notifications?role=${userRole}`);
    if (res.ok) {
      setNotifications(await res.json());
      setNotifLoaded(true);
    }
  }, []);

  // Load notifications on mount + subscribe to Realtime for new ones
  useEffect(() => {
    loadNotifications();

    const supabase = createClient();
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const roleLabel: Record<string, string> = {
    student: "Estudiante",
    instructor: "Docente",
    admin: "Administrador",
    superadmin: "Superadmin",
  };

  // Impersonation state
  const isSuperadmin = realRole === "superadmin";
  const [impRole, setImpRole] = useState<string>(isImpersonating ? userRole : "");
  const [impEstId, setImpEstId] = useState<string>("");
  const [impLoading, setImpLoading] = useState(false);

  const handleImpersonate = async (role: string, estId: string) => {
    if (!role || !estId || !establishments) return;
    const est = establishments.find((e) => e.id === estId);
    if (!est) return;
    setImpLoading(true);
    await setImpersonation(role as "student" | "instructor" | "admin", estId, est.name);
    const targetPath = role === "instructor" ? "/docente/dashboard" : role === "admin" ? "/admin/dashboard" : "/dashboard";
    window.location.href = targetPath;
  };

  const handleClearImpersonation = async () => {
    setImpLoading(true);
    setImpRole("");
    setImpEstId("");
    await clearImpersonation();
    window.location.href = "/admin/dashboard";
  };

  return (
    <>
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="h-8 bg-amber-500 flex items-center justify-center gap-3 px-4">
          <Eye size={14} className="text-white" />
          <span className="text-xs font-medium text-white">
            Viendo como: {impersonationLabel}
          </span>
          <button
            onClick={handleClearImpersonation}
            disabled={impLoading}
            className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      )}
    <header className="h-12 bg-[#2D3561] flex items-center justify-end pl-3 sm:pl-5 pr-3 sm:pr-5 gap-2">
      {/* Impersonation controls (superadmin only) */}
      {isSuperadmin && !isImpersonating && (
        <div className="hidden lg:flex items-center gap-1.5 mr-auto">
          <Eye size={13} className="text-white/40" />
          <select
            value={impRole}
            onChange={(e) => { setImpRole(e.target.value); setImpEstId(""); }}
            className="bg-white/10 text-white/80 text-[11px] rounded px-2 py-1 border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
          >
            <option value="" className="text-gray-900">Ver como...</option>
            <option value="student" className="text-gray-900">Estudiante</option>
            <option value="instructor" className="text-gray-900">Docente</option>
            <option value="admin" className="text-gray-900">Admin</option>
          </select>
          {impRole && establishments && (
            <select
              value={impEstId}
              onChange={(e) => {
                setImpEstId(e.target.value);
                if (e.target.value) handleImpersonate(impRole, e.target.value);
              }}
              disabled={impLoading}
              className="bg-white/10 text-white/80 text-[11px] rounded px-2 py-1 border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer disabled:opacity-50 max-w-[180px]"
            >
              <option value="" className="text-gray-900">{"Instituci\u00f3n..."}</option>
              {establishments.map((e) => (
                <option key={e.id} value={e.id} className="text-gray-900">{e.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Accessibility */}
      <AccessibilityButton initialPrefs={a11yPrefs || {}} />

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); if (!notifLoaded) loadNotifications(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all cursor-pointer hover:scale-105 relative"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] sm:w-80 max-w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Notificaciones</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-sidebar hover:underline">
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    disabled={clickedNotifId === n.id}
                    onClick={() => {
                      setClickedNotifId(n.id);
                      // Mark as read
                      fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: n.id }),
                      });
                      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
                      // Navigate
                      if (n.href) window.location.href = n.href;
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      clickedNotifId === n.id ? "opacity-60" : ""
                    } ${n.is_read ? "" : "bg-sidebar/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && clickedNotifId !== n.id && (
                        <span className="w-2 h-2 rounded-full bg-sidebar flex-shrink-0 mt-1.5" />
                      )}
                      {clickedNotifId === n.id && (
                        <svg className="animate-spin w-3 h-3 text-sidebar flex-shrink-0 mt-1" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${
                          clickedNotifId === n.id
                            ? "text-gray-400"
                            : n.is_read ? "text-gray-600" : "font-semibold text-gray-900"
                        }`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-gray-300 mt-1">
                          {new Date(n.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} {new Date(n.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400">Sin notificaciones</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Support */}
      <button
        onClick={() => { setShowSupport(true); setNotifOpen(false); setProfileOpen(false); }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all cursor-pointer hover:scale-105"
        title="Soporte t&eacute;cnico"
      >
        <LifeBuoy size={16} />
      </button>

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/15 transition-all cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">{initials}</span>
            )}
          </div>
          <span className="text-xs text-white/80 font-medium hidden lg:block max-w-[120px] truncate group-hover:text-white transition-colors">
            {userName.split(" ")[0]}
          </span>
          <ChevronDown size={12} className={`text-white/50 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
              <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide text-sidebar bg-sidebar/10 px-2 py-0.5 rounded-full">
                {roleLabel[userRole] || userRole}
              </span>
            </div>

            {/* Actions */}
            <div className="py-1">
              <button
                onClick={() => { setProfileOpen(false); router.push("/mi-perfil"); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} className="text-gray-400" />
                Mi perfil
              </button>
              {userRole !== "instructor" && (
                <button
                  onClick={() => { setProfileOpen(false); router.push("/progreso"); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <BarChart3 size={15} className="text-gray-400" />
                  Mi progreso
                </button>
              )}
              <button
                onClick={() => { setProfileOpen(false); router.push("/sobre"); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Info size={15} className="text-gray-400" />
                Sobre GlorIA
              </button>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Support modal */}
      {showSupport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowSupport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <LifeBuoy size={22} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Soporte t&eacute;cnico</h2>
                  <p className="text-xs text-gray-500">Tu mensaje llegar&aacute; a idea@ugm.cl</p>
                </div>
              </div>
              <button onClick={() => setShowSupport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {supportSent ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-500 text-2xl">&#10003;</span>
                </div>
                <p className="text-sm font-medium text-gray-900">Mensaje enviado</p>
                <p className="text-xs text-gray-500 mt-1">Te responderemos a la brevedad a tu correo.</p>
                <button onClick={() => { setShowSupport(false); setSupportSent(false); setSupportSubject(""); setSupportBody(""); }}
                  className="mt-4 bg-sidebar text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors">
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                  <input type="text" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder="Describe brevemente el problema"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
                  <textarea value={supportBody} onChange={(e) => setSupportBody(e.target.value)}
                    placeholder="Describe tu problema o solicitud con el mayor detalle posible..."
                    rows={5}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sidebar" />
                </div>
                {supportError && <p className="text-xs text-red-500">{supportError}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={async () => {
                    if (!supportSubject.trim() || !supportBody.trim()) return;
                    setSupportSending(true); setSupportError("");
                    const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ subject: supportSubject.trim(), body: supportBody.trim() }) });
                    if (!res.ok) { const d = await res.json(); setSupportError(d.error || "Error al enviar"); setSupportSending(false); return; }
                    setSupportSent(true); setSupportSending(false);
                  }} disabled={!supportSubject.trim() || !supportBody.trim() || supportSending}
                    className="flex-1 bg-sidebar text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#354080] transition-colors disabled:opacity-50">
                    {supportSending ? "Enviando..." : "Enviar mensaje"}
                  </button>
                  <button onClick={() => setShowSupport(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
    </>
  );
}
