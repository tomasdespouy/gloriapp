"use client";

import { useEffect, useRef } from "react";
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

export default function PatientShowcase({ patients }: { patients: Patient[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // Auto-scroll carousel
  useEffect(() => {
    const track = trackRef.current;
    if (!track || patients.length < 3) return;

    let animId: number;
    let speed = 0.5; // px per frame

    const step = () => {
      if (!pausedRef.current && track) {
        track.scrollLeft += speed;
        // Loop: when we've scrolled past half (the duplicated set), reset
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

  if (patients.length === 0) return null;

  // Duplicate patients for seamless loop
  const displayed = [...patients, ...patients];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <section id="pacientes" className="bg-[#E8E8E8] py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Conoce a los pacientes
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Cada paciente tiene una historia única, personalidad definida y
              reacciones realistas ante distintos enfoques terapéuticos
            </p>
          </div>
        </ScrollReveal>

        {/* Carousel */}
        <div
          ref={trackRef}
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
          onTouchStart={() => { pausedRef.current = true; }}
          onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 3000); }}
          className="flex gap-5 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayed.map((patient, i) => {
            const slug = slugify(patient.name);
            const country = patient.country_origin || patient.country_residence || "";
            const videoSrc = `${supabaseUrl}/storage/v1/object/public/patients/${slug}.mp4`;
            const posterSrc = `${supabaseUrl}/storage/v1/object/public/patients/${slug}.png`;

            return (
              <div
                key={`${patient.name}-${i}`}
                className="flex-shrink-0 w-[220px] sm:w-[260px] group"
              >
                {/* Video card */}
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-200 shadow-md group-hover:shadow-xl transition-shadow duration-300">
                  <video
                    src={videoSrc}
                    poster={posterSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
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

                  {/* Gradient overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />

                  {/* Info over video */}
                  <div className="absolute bottom-0 inset-x-0 p-4 text-white">
                    <h3 className="text-lg font-bold leading-tight">{patient.name}</h3>
                    <p className="text-sm text-white/80 mt-0.5">
                      {patient.age} años{country ? ` \u00B7 ${country}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
