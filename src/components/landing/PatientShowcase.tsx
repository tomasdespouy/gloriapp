"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

interface Patient {
  name: string;
  age: number;
  country_origin: string | null;
  country_residence: string | null;
}

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
}

interface PatientShowcaseProps {
  patients: Patient[];
}

function PatientVideoCard({ patient, supabaseUrl }: { patient: Patient; supabaseUrl: string | undefined }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        const video = videoRef.current;
        if (!video) return;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const slug = slugify(patient.name);
  const country = patient.country_origin || patient.country_residence || "";
  const videoSrc = `${supabaseUrl}/storage/v1/object/public/patients/${slug}.mp4`;
  const posterSrc = `${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`;

  return (
    <div
      ref={cardRef}
      className="flex-shrink-0 w-[180px] sm:w-[220px] group/card"
    >
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-200 shadow-md group-hover/card:shadow-xl transition-shadow duration-300">
        {isVisible ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent && !parent.querySelector("img")) {
                const img = document.createElement("img");
                img.src = posterSrc;
                img.alt = patient.name;
                img.className = "w-full h-full object-cover absolute inset-0";
                parent.appendChild(img);
              }
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterSrc} alt={patient.name} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white">
          <h3 className="text-sm sm:text-base font-bold leading-tight">{patient.name}</h3>
          <p className="text-xs sm:text-sm text-white/80 mt-0.5">
            {patient.age} a&ntilde;os{country ? ` \u00b7 ${country}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PatientShowcase({ patients }: PatientShowcaseProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Auto-scroll
  const pausedRef = useRef(false);
  const speedRef = useRef(0.6);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || patients.length < 3) return;

    let animId: number;

    const step = () => {
      if (!pausedRef.current && track) {
        track.scrollLeft += speedRef.current;
        const half = track.scrollWidth / 2;
        if (track.scrollLeft >= half) {
          track.scrollLeft -= half;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [patients.length]);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 10);
    setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth - 10);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", updateArrows);
    updateArrows();
    return () => track.removeEventListener("scroll", updateArrows);
  }, [updateArrows]);

  const scroll = (direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    pausedRef.current = true;
    const amount = direction === "left" ? -400 : 400;
    track.scrollBy({ left: amount, behavior: "smooth" });
    // Resume auto-scroll after 4 seconds
    setTimeout(() => { pausedRef.current = false; }, 4000);
  };

  if (patients.length === 0) return null;

  const displayed = [...patients, ...patients];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <section id="pacientes" className="bg-[#F5F5F5] py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Conoce a los pacientes
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {`${patients.length} pacientes con historias \u00fanicas, personalidad definida y reacciones realistas ante distintos enfoques terap\u00e9uticos`}
            </p>
          </div>
        </ScrollReveal>

        {/* Carousel with arrows */}
        <div className="relative group">
          {/* Left arrow */}
          <button
            onClick={() => scroll("left")}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition-all ${
              canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronLeft size={22} />
          </button>

          {/* Right arrow */}
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition-all opacity-100"
          >
            <ChevronRight size={22} />
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            onTouchStart={() => { pausedRef.current = true; }}
            onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 4000); }}
            className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide px-1 py-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {displayed.map((patient, i) => (
              <PatientVideoCard
                key={`${patient.name}-${i}`}
                patient={patient}
                supabaseUrl={supabaseUrl}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
