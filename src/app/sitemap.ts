import type { MetadataRoute } from "next";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return [
    {
      url: `${normalizedBaseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

