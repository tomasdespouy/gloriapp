import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GlorIA — Pacientes IA para Psicología",
    short_name: "GlorIA",
    description:
      "Practica terapia con pacientes simulados por inteligencia artificial. Plataforma de formación clínica para estudiantes de psicología.",
    start_url: "/",
    display: "browser",
    background_color: "#FAFAFA",
    theme_color: "#4A55A2",
    lang: "es",
    icons: [
      {
        src: "/icon.png",
        sizes: "234x233",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
      },
    ],
  };
}
