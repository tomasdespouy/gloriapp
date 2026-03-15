"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, User, LogOut, Settings, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
}

export default function TopHeader({ userName, userEmail, userRole }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      setNotifications(await res.json());
      setNotifLoaded(true);
    }
  }, []);

  // Load notifications on mount
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

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

  return (
    <header className="h-12 bg-[#2D3561] flex items-center justify-end px-5 gap-2">
      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); if (!notifLoaded) loadNotifications(); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all relative"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
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
                    onClick={() => {
                      // Mark as read (fire and forget)
                      fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: n.id }),
                      });
                      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
                      setNotifOpen(false);
                      // Navigate — use window.location for guaranteed navigation
                      if (n.href) window.location.href = n.href;
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      n.is_read ? "" : "bg-sidebar/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-sidebar flex-shrink-0 mt-1.5" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${n.is_read ? "text-gray-600" : "font-semibold text-gray-900"}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-gray-300 mt-1">
                          {new Date(n.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
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

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{initials}</span>
          </div>
          <span className="text-xs text-white/80 font-medium hidden sm:block max-w-[120px] truncate">
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
                onClick={() => { setProfileOpen(false); router.push("/progreso"); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} className="text-gray-400" />
                Mi progreso
              </button>
              <button
                onClick={() => { setProfileOpen(false); router.push("/sobre"); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings size={15} className="text-gray-400" />
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
    </header>
  );
}
