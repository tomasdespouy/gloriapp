"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const universities = [
  {
    name: "Universidad Gabriela Mistral",
    short: "UGM",
    country: "Chile",
    logo: "/universities/ugm.png",
    color: "#1B3A6B",
  },
  {
    name: "Universidad de San Buenaventura",
    short: "USB Cali",
    country: "Colombia",
    logo: `${supabaseUrl}/storage/v1/object/public/universities/usb-cali.png`,
    color: "#8B0000",
  },
  {
    name: "Universidad Peruana de Ciencias Aplicadas",
    short: "UPC",
    country: "Per\u00fa",
    logo: `${supabaseUrl}/storage/v1/object/public/universities/upc-peru.png`,
    color: "#E31837",
  },
  {
    name: "Universidad de San Mart\u00edn de Porres",
    short: "USMP",
    country: "Per\u00fa",
    logo: `${supabaseUrl}/storage/v1/object/public/universities/usmp.png`,
    color: "#003366",
  },
  {
    name: "Universidad del Caribe",
    short: "UNICARIBE",
    country: "Rep. Dominicana",
    logo: `${supabaseUrl}/storage/v1/object/public/universities/unicaribe.png`,
    color: "#005BAA",
  },
];

export default function UniversitiesSection() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? universities.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === universities.length - 1 ? 0 : c + 1));

  // Show 3 at a time on desktop, 1 on mobile
  const getVisible = () => {
    const items = [];
    for (let i = 0; i < 3; i++) {
      items.push(universities[(current + i) % universities.length]);
    }
    return items;
  };

  const visible = getVisible();

  return (
    <section className="bg-white py-14 lg:py-20 border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-[#4A55A2] uppercase tracking-widest mb-2">
              Red de instituciones
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              {`${universities.length} universidades conf\u00edan en GlorIA`}
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm">
              {"Instituciones l\u00edderes en formaci\u00f3n de psicolog\u00eda en Latinoam\u00e9rica"}
            </p>
          </div>
        </ScrollReveal>

        {/* Manual carousel */}
        <div className="flex items-center gap-4">
          {/* Prev button */}
          <button
            onClick={prev}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#4A55A2] hover:border-[#4A55A2]/30 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Cards */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {visible.map((uni) => (
              <div
                key={uni.short}
                className="flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border border-gray-100 hover:border-[#4A55A2]/20 hover:shadow-md transition-all duration-300"
              >
                <div className="w-28 h-28 rounded-2xl bg-white border border-gray-200 flex items-center justify-center p-4 overflow-hidden relative">
                  {uni.logo.startsWith("/") ? (
                    <Image
                      src={uni.logo}
                      alt={uni.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uni.logo}
                      alt={uni.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector("span")) {
                          const span = document.createElement("span");
                          span.className = "text-xl font-bold";
                          span.style.color = uni.color;
                          span.textContent = uni.short;
                          parent.appendChild(span);
                        }
                      }}
                    />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">{uni.name}</p>
                  <p className="text-xs text-gray-400">{uni.country}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={next}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#4A55A2] hover:border-[#4A55A2]/30 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {universities.map((uni, i) => (
            <button
              key={uni.short}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? "bg-[#4A55A2] w-6" : "bg-gray-200 hover:bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
