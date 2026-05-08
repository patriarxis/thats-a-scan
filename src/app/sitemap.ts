import type { MetadataRoute } from "next";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const lastModified = new Date();

  return [
    {
      url: `${normalizedBaseUrl}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: {
          el: `${normalizedBaseUrl}/`,
          en: `${normalizedBaseUrl}/en`,
        },
      },
    },
    {
      url: `${normalizedBaseUrl}/en`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${normalizedBaseUrl}/en`,
          el: `${normalizedBaseUrl}/`,
        },
      },
    },
  ];
}

