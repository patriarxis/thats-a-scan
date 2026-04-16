import type { MetadataRoute } from "next";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${normalizedBaseUrl}/sitemap.xml`,
  };
}

