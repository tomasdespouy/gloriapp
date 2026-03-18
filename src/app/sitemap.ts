import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://glor-ia.com";

  const publicPages = [
    { path: "", changeFrequency: "monthly" as const, priority: 1 },
    { path: "/privacidad", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/terminos", changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of publicPages) {
    entries.push({
      url: `${baseUrl}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          es: `${baseUrl}${page.path}`,
          en: `${baseUrl}/en${page.path}`,
          pt: `${baseUrl}/pt${page.path}`,
        },
      },
    });

    // Also add /en and /pt versions
    entries.push({
      url: `${baseUrl}/en${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority * 0.9,
      alternates: {
        languages: {
          es: `${baseUrl}${page.path}`,
          en: `${baseUrl}/en${page.path}`,
          pt: `${baseUrl}/pt${page.path}`,
        },
      },
    });

    entries.push({
      url: `${baseUrl}/pt${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority * 0.9,
      alternates: {
        languages: {
          es: `${baseUrl}${page.path}`,
          en: `${baseUrl}/en${page.path}`,
          pt: `${baseUrl}/pt${page.path}`,
        },
      },
    });
  }

  return entries;
}
