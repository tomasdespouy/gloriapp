"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

interface PatientCardProps {
  id: string;
  name: string;
  age: number;
  occupation: string | null;
  quote: string;
  difficultyLevel: string;
  tags?: string[];
}

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

export default function PatientCard({ id, name, age, occupation, quote, difficultyLevel, tags }: PatientCardProps) {
  const difficulty = difficultyLabels[difficultyLevel] || difficultyLabels.beginner;
  const videoSlug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center">
      {/* Avatar video */}
      <div className="w-24 h-24 rounded-full overflow-hidden bg-sidebar flex items-center justify-center mb-4">
        <video
          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${videoSlug}.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            // Fallback to local file
            if (!target.dataset.fallback) {
              target.dataset.fallback = "1";
              target.src = `/patients/${videoSlug}.mp4`;
            } else {
              // No video at all — try image
              target.style.display = "none";
              const img = document.createElement("img");
              img.src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/patients/${videoSlug}.png`;
              img.alt = initials;
              img.className = "w-full h-full object-cover";
              img.onerror = () => {
                img.onerror = null;
                img.src = `/patients/${videoSlug}.png`;
                img.onerror = () => {
                  img.style.display = "none";
                  target.parentElement!.innerHTML = `<span class="text-white text-xl font-bold">${initials}</span>`;
                };
              };
              target.parentElement!.appendChild(img);
            }
          }}
        />
      </div>

      {/* Name & Age */}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-500 mb-1">{age} años &middot; {occupation}</p>

      {/* Difficulty badge */}
      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium mb-2 ${difficulty.color}`}>
        {difficulty.emoji} {difficulty.label}
      </span>

      {/* Tags with emojis */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mb-3">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tagEmojis[tag] || "📌"} {tag}
            </span>
          ))}
        </div>
      )}

      {/* Quote */}
      <p className="text-sm text-gray-600 italic text-center mb-5 line-clamp-2">&ldquo;{quote}&rdquo;</p>

      {/* Action */}
      <Link
        href={`/chat/${id}`}
        className="flex items-center justify-center gap-2 bg-btn-action hover:bg-btn-action-hover text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors w-full"
      >
        <MessageSquare size={16} />
        Iniciar conversación
      </Link>
    </div>
  );
}
