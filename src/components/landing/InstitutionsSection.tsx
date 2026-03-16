"use client";

import { useEffect, useRef } from "react";
import ScrollReveal from "./ScrollReveal";

interface Institution {
  name: string;
  slug: string;
  logo_url: string | null;
  country: string | null;
}

export default function InstitutionsSection({ institutions }: { institutions: Institution[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || institutions.length < 3) return;

    let animId: number;
    const speed = 0.4;

    const step = () => {
      if (!pausedRef.current && track) {
        track.scrollLeft += speed;
        const half = track.scrollWidth / 2;
        if (track.scrollLeft >= half) {
          track.scrollLeft -= half;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [institutions.length]);

  if (institutions.length === 0) return null;

  const displayed = [...institutions, ...institutions];

  return (
    <section className="bg-white py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#4A55A2] mb-2">
              Red de instituciones
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Universidades que confían en GlorIA
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Instituciones líderes en formación de psicología en Latinoamérica
              que están transformando la práctica clínica de sus estudiantes
            </p>
          </div>
        </ScrollReveal>

        <div
          ref={trackRef}
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
          onTouchStart={() => { pausedRef.current = true; }}
          onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 3000); }}
          className="flex gap-6 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayed.map((inst, i) => (
            <div
              key={`${inst.slug}-${i}`}
              className="flex-shrink-0 w-[180px] text-center"
            >
              <div className="w-28 h-28 mx-auto rounded-2xl bg-gray-50 border border-gray-100 shadow-sm flex items-center justify-center p-3">
                {inst.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inst.logo_url}
                    alt={inst.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-300">
                    {inst.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900 leading-tight">
                {inst.name}
              </p>
              {inst.country && (
                <p className="text-xs text-gray-500 mt-0.5">{inst.country}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
