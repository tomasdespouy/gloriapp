"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ActiveSession {
  id: string;
  patientId: string;
  patientName: string;
  sessionNumber: number;
  activeSeconds: number;
  status: string;
}

const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

export default function SessionCarousel({
  sessions,
  supabaseUrl,
}: {
  sessions: ActiveSession[];
  supabaseUrl: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("a")?.offsetWidth || 200;
    el.scrollBy({ left: dir === "left" ? -cardWidth - 12 : cardWidth + 12, behavior: "smooth" });
  };

  return (
    <div className="relative group/carousel">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-1"
      >
        {sessions.map((s) => {
          const patientSlug = slug(s.patientName);
          const mins = Math.round(s.activeSeconds / 60);
          return (
            <Link
              key={s.id}
              href={`/chat/${s.patientId}?conversationId=${s.id}`}
              className="flex-shrink-0 w-[160px] sm:w-[180px] bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${supabaseUrl}/storage/v1/object/public/patients/${patientSlug}.png`}
                  alt={s.patientName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-sidebar text-white font-semibold text-[10px] px-2.5 py-1 rounded-lg opacity-90 group-hover:opacity-100 transition-opacity">
                  Retomar →
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-900">Sesión #{s.sessionNumber}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{s.patientName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {mins > 0 ? `${mins} min` : "Recién iniciada"}
                  {s.status === "abandoned" ? " · Abandonada" : " · En curso"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-sidebar hover:border-sidebar/30 transition-colors cursor-pointer z-10"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-sidebar hover:border-sidebar/30 transition-colors cursor-pointer z-10"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
