"use client";

import { Home, MessageSquare, User, History, ChevronLeft } from "lucide-react";

const navItems = [
  { icon: Home, label: "Inicio" },
  { icon: MessageSquare, label: "Mi última sesión" },
  { icon: User, label: "Pacientes IA" },
  { icon: History, label: "Mi historial" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-sidebar flex flex-col text-white z-50">
      {/* Collapse button */}
      <button className="self-end p-3 text-white/70 hover:text-white transition-colors">
        <ChevronLeft size={20} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 mb-10">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="17" stroke="#4DD0E1" strokeWidth="2.5" fill="none" />
          <path
            d="M15 18C15 15.24 17.24 13 20 13C22.76 13 25 15.24 25 18C25 20.76 22.76 23 20 23"
            stroke="#4DD0E1"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M20 23C18.5 23 15.5 24 13 27" stroke="#4DD0E1" strokeWidth="2" strokeLinecap="round" />
          <circle cx="27" cy="27" r="4" fill="#4DD0E1" opacity="0.3" />
        </svg>
        <span className="text-2xl font-bold tracking-wide">
          Glori<span className="text-accent">IA</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 px-6">
        {navItems.map((item) => (
          <button
            key={item.label}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-hover hover:bg-[#354080] text-white text-sm font-medium w-full text-left transition-colors"
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer - University */}
      <div className="mt-auto px-6 pb-6">
        <p className="text-white/70 text-xs mb-3">Proyecto impulsado :</p>
        <div className="flex flex-col items-center">
          <img
            src="/ugm-logo.png"
            alt="Universidad Gabriela Mistral"
            className="h-14 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement!.innerHTML = `
                <div class="text-center">
                  <p class="text-white font-bold text-xs">UNIVERSIDAD</p>
                  <p class="text-white font-bold text-sm">Gabriela Mistral</p>
                  <p class="text-green-400 text-xs italic">Juntos escribamos tu futuro</p>
                </div>
              `;
            }}
          />
        </div>
      </div>
    </aside>
  );
}
