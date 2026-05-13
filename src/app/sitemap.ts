import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const normalizedBaseUrl = getSiteUrl().toString().replace(/\/$/, "");
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

