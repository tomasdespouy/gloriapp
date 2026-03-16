"use client";

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

const heroVideos = [
  { slug: "lucia-mendoza", name: "Lucia" },
  { slug: "marcos-herrera", name: "Marcos" },
  { slug: "carmen-torres", name: "Carmen" },
  { slug: "diego-fuentes", name: "Diego" },
  { slug: "roberto-salas", name: "Roberto" },
];

export default function HeroSection() {
  return (
    <section className="min-h-[calc(100vh-64px)] flex items-center bg-white pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left - Text */}
          <ScrollReveal>
            <div className="space-y-5">
              <div className="inline-flex items-center gap-3 bg-[#4A55A2]/10 px-3 py-1.5 rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/universities/ugm.png" alt="Universidad Gabriela Mistral" className="h-6 w-auto" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-gray-900 leading-[1.1]">
                Práctica terapéutica con pacientes que{" "}
                <span className="text-[#4A55A2]">sienten</span>,{" "}
                <span className="text-[#4A55A2]">reaccionan</span> y{" "}
                <span className="text-[#4A55A2]">desafian</span>
              </h1>
              <p className="text-base text-gray-600 max-w-lg">
                Entrena tus habilidades clínicas conversando con pacientes
                simulados por inteligencia artificial. Un entorno seguro para
                aprender antes de la práctica real.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center font-medium text-white bg-[#4A55A2] px-6 py-3 rounded-lg hover:bg-[#3D4890] transition-colors text-base"
                >
                  Comenzar gratis
                </Link>
                <a
                  href="#como-funciona"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("como-funciona")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center justify-center font-medium text-[#4A55A2] border border-[#4A55A2] px-6 py-3 rounded-lg hover:bg-[#4A55A2]/5 transition-colors text-base"
                >
                  Ver como funciona
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* Right - Honeycomb video layout */}
          <ScrollReveal delay={200}>
            <div className="relative flex items-center justify-center min-h-[300px] sm:min-h-[360px] lg:min-h-[420px]">
              {/* Decorative blurs */}
              <div className="absolute top-4 right-4 w-40 h-40 bg-[#4DD0E1]/15 rounded-full blur-3xl" />
              <div className="absolute bottom-8 left-8 w-36 h-36 bg-[#4A55A2]/10 rounded-full blur-3xl" />

              {/* Top center - large */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2">
                <VideoCircle slug={heroVideos[0].slug} name={heroVideos[0].name} size="lg" />
              </div>
              {/* Mid left */}
              <div className="absolute top-[35%] left-2 sm:left-6">
                <VideoCircle slug={heroVideos[1].slug} name={heroVideos[1].name} size="md" />
              </div>
              {/* Mid right */}
              <div className="absolute top-[30%] right-2 sm:right-6">
                <VideoCircle slug={heroVideos[2].slug} name={heroVideos[2].name} size="md" />
              </div>
              {/* Bottom left */}
              <div className="absolute bottom-0 left-[18%]">
                <VideoCircle slug={heroVideos[3].slug} name={heroVideos[3].name} size="sm" />
              </div>
              {/* Bottom right */}
              <div className="absolute bottom-2 right-[18%]">
                <VideoCircle slug={heroVideos[4].slug} name={heroVideos[4].name} size="sm" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function VideoCircle({
  slug,
  name,
  size,
}: {
  slug: string;
  name: string;
  size: "lg" | "md" | "sm";
}) {
  const sizeClasses =
    size === "lg"
      ? "w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48"
      : size === "md"
      ? "w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36"
      : "w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28";

  return (
    <div
      className={`${sizeClasses} rounded-full overflow-hidden border-[3px] border-white shadow-lg bg-[#4A55A2] flex items-center justify-center`}
    >
      <video
        src={`/patients/${slug}.mp4`}
        poster={`/patients/${slug}.webp`}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const img = document.createElement("img");
          img.src = `/patients/${slug}.png`;
          img.alt = name;
          img.className = "w-full h-full object-cover";
          target.parentElement!.appendChild(img);
        }}
      />
    </div>
  );
}
