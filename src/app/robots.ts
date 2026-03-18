import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/chat/",
          "/pacientes/",
          "/aprendizaje/",
          "/historial/",
          "/progreso/",
          "/review/",
          "/perfiles/",
          "/api/",
          "/login",
          "/register",
          "/dashboard",
        ],
      },
    ],
    sitemap: "https://glor-ia.com/sitemap.xml",
  };
}
