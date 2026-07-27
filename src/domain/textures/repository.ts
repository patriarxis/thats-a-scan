import "server-only";

import { getPayloadClient } from "@/payload/getPayloadClient";
import { mapPayloadTextureToFeature } from "./mapPayloadTexture";
import type { MapBounds, TextureFeature, TextureFeatureCollection } from "./types";

const CACHE_TTL_MS = 30_000;
let cachedCollection: { data: TextureFeatureCollection; at: number } | null = null;

async function fetchPublishedTextures(): Promise<TextureFeatureCollection> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "textures",
    where: {
      status: {
        equals: "published",
      },
    },
    depth: 2,
    limit: 500,
    pagination: false,
  });

  return {
    type: "FeatureCollection",
    features: result.docs.map(mapPayloadTextureToFeature),
  };
}

export async function loadTextures(): Promise<TextureFeatureCollection> {
  if (cachedCollection && Date.now() - cachedCollection.at < CACHE_TTL_MS) {
    return cachedCollection.data;
  }

  const data = await fetchPublishedTextures();
  cachedCollection = { data, at: Date.now() };
  return data;
}

export function filterTexturesByBounds(
  features: TextureFeature[],
  bounds: MapBounds,
): TextureFeature[] {
  const { north_west, south_east } = bounds;
  const north = north_west.latitude;
  const south = south_east.latitude;
  const west = north_west.longitude;
  const east = south_east.longitude;

  return features.filter((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return lat <= north && lat >= south && lng >= west && lng <= east;
  });
}

export async function findTextureById(id: string): Promise<TextureFeature | undefined> {
  const normalized = id.trim().toLowerCase();
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "textures",
    where: {
      and: [
        { status: { equals: "published" } },
        {
          or: [
            { textureId: { equals: normalized } },
            { slug: { equals: normalized } },
          ],
        },
      ],
    },
    depth: 2,
    limit: 1,
  });

  const doc = result.docs[0];
  return doc ? mapPayloadTextureToFeature(doc) : undefined;
}

export async function searchTextures(query: string, limit = 10): Promise<TextureFeature[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const { features } = await loadTextures();
  const scored = features
    .map((feature) => {
      const props = feature.properties;
      const haystack = [
        props.title,
        props.description,
        props.neighborhood,
        props.category,
        ...props.tags,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(q)) return null;

      let score = 0;
      if (props.title.toLowerCase().includes(q)) score += 10;
      if (props.neighborhood.toLowerCase().includes(q)) score += 8;
      if (props.category.includes(q)) score += 6;
      if (props.tags.some((tag) => tag.includes(q))) score += 4;
      if (props.description.toLowerCase().includes(q)) score += 2;

      return { feature, score };
    })
    .filter((item): item is { feature: TextureFeature; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.feature);
}

export function clearTextureCache(): void {
  cachedCollection = null;
}
