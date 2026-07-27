import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { loadTextures } from "@/domain/textures/repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl().toString().replace(/\/$/, "");
  const lastModified = new Date();

  let textureEntries: MetadataRoute.Sitemap = [];
  try {
    const collection = await loadTextures();
    textureEntries = collection.features.map((feature) => ({
      url: `${baseUrl}/texture/${feature.properties.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB may be unavailable or schema pending migration during build
  }

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    ...textureEntries,
  ];
}
