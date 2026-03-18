"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Play, X, Volume2 } from "lucide-react";

interface PatientCardProps {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  quote: string;
  difficultyLevel: string;
  tags?: string[];
  activeConversationId?: string;
  country?: string | null;
  hasVoice?: boolean;
}

const countryFlagSrc: Record<string, string> = {
  "Chile": "/flags/cl.png",
  "Perú": "/flags/pe.png",
  "Colombia": "/flags/co.png",
  "México": "/flags/mx.png",
  "Argentina": "/flags/ar.png",
  "República Dominicana": "/flags/do.png",
  "Venezuela": "/flags/ve.png",
};

const difficultyLabels: Record<string, { label: string; color: string; emoji: string }> = {
  beginner: { label: "Principiante", color: "bg-green-100 text-green-700", emoji: "🌱" },
  intermediate: { label: "Intermedio", color: "bg-yellow-100 text-yellow-700", emoji: "🌿" },
  advanced: { label: "Avanzado", color: "bg-red-100 text-red-700", emoji: "🌳" },
};

const tagEmojis: Record<string, string> = {
  duelo: "🕊️",
  insomnio: "😴",
  pareja: "💑",
  ansiedad: "😰",
  masculinidad: "👨",
  autoestima: "🪞",
  aislamiento: "🏠",
  personalidad: "🎭",
  abandono: "💔",
  resistencia: "🛡️",
  transferencia: "🔄",
  universitario: "🎓",
  adulto_mayor: "👴",
  ideacion: "⚠️",
  depresión: "🌧️",
  trauma: "🩹",
  familia: "👨‍👩‍👧",
  trabajo: "💼",
  adiccion: "🔗",
  social: "👥",
};

export default function PatientCard({ id, name, age, occupation, quote, difficultyLevel, tags, activeConversationId, country, hasVoice }: PatientCardProps) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const difficulty = difficultyLabels[difficultyLevel] || difficultyLabels.beginner;
  const videoSlug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${videoSlug}.mp4`;
  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${videoSlug}.png`;

  const hasActiveSession = !!activeConversationId;
  const chatHref = hasActiveSession
    ? `/chat/${id}?conversationId=${activeConversationId}`
    : `/chat/${id}`;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 flex flex-col items-center relative">
        {/* Difficulty badge — top left */}
        <span className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full font-medium ${difficulty.color}`}>
          {difficulty.label}
        </span>

        {/* Voice icon — top left after difficulty */}
        {hasVoice && (
          <span title="Modo voz disponible" className="absolute top-3 left-[110px] text-sidebar opacity-60">
            <Volume2 size={14} />
          </span>
        )}

        {/* Country flag — top right */}
        {country && countryFlagSrc[country] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={countryFlagSrc[country]}
            alt={country}
            title={country}
            className="absolute top-3 right-3 w-6 h-4 rounded-sm object-cover shadow-sm border border-gray-100"
          />
        )}

        {/* Avatar video — clickable to expand */}
        <button
          onClick={() => setShowVideoModal(true)}
          className="w-24 h-24 rounded-full overflow-hidden bg-sidebar flex items-center justify-center mb-4 cursor-pointer hover:ring-2 hover:ring-sidebar/30 transition-all"
        >
          <video
            src={videoUrl}
            poster={imageUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const img = document.createElement("img");
              img.src = imageUrl;
              img.alt = name;
              img.className = "w-full h-full object-cover";
              img.onerror = () => {
                img.style.display = "none";
                target.parentElement!.innerHTML = `<span class="text-white text-xl font-bold">${initials}</span>`;
              };
              target.parentElement!.appendChild(img);
            }}
          />
        </button>

        {/* Name & Age */}
        <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
        <p className="text-sm text-gray-500 mb-1">{age} años &middot; {occupation}</p>

        {/* Action */}
        <Link
          href={chatHref}
          className={`flex items-center justify-center gap-2 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors w-full ${
            hasActiveSession
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-btn-action hover:bg-btn-action-hover"
          }`}
        >
          {hasActiveSession ? <Play size={16} /> : <MessageSquare size={16} />}
          {hasActiveSession ? "Retomar conversación" : "Iniciar conversación"}
        </Link>
      </div>

      {/* Video modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
          onClick={() => setShowVideoModal(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="rounded-2xl overflow-hidden" style={{ width: 300, height: 300 }}>
              <video
                src={videoUrl}
                poster={imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const img = document.createElement("img");
                  img.src = imageUrl;
                  img.alt = name;
                  img.className = "w-full h-full object-cover";
                  target.parentElement!.appendChild(img);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
