"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const LEGACY_KEY = "gloria_welcome_seen";

function scopedKey(userId: string | undefined | null): string {
  return userId ? `gloria_welcome_seen:${userId}` : LEGACY_KEY;
}

export default function WelcomeVideoModal({
  userId,
  userRole,
}: {
  userId?: string | null;
  userRole?: string | null;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Onboarding video is for students only. Instructors, admins and
    // superadmins already know the platform and don't need the intro.
    if (userRole !== "student") return;
    try {
      const key = scopedKey(userId);
      const seen = localStorage.getItem(key);
      if (!seen) {
        // Small delay so the dashboard renders first
        const timer = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable — skip modal
    }
  }, [userId, userRole]);

  const handleClose = () => {
    try {
      localStorage.setItem(scopedKey(userId), "true");
    } catch {
      // noop
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors z-20"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Video */}
          <div className="aspect-video">
            <iframe
              src="https://www.youtube.com/embed/N-TJDF7_A1k?autoplay=1&rel=0"
              title="Bienvenido a GlorIA"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/icon.png" alt="GlorIA" className="h-9 w-9 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Bienvenido a GlorIA</p>
                <p className="text-xs text-gray-500">Plataforma de práctica terapéutica con IA</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="bg-sidebar hover:bg-[#354080] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Comenzar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
