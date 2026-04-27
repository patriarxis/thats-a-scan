import { get, put, type GetBlobResult, type PutBlobResult } from "@vercel/blob";
import type { MerchantFeatureCollection } from "@/types";
import { getHeatmapData } from "./heatmapUtils";

export const HEATMAP_BLOB_PATHNAME = "heatmap.geojson";
export const HEATMAP_TTL_SECONDS = 30 * 24 * 60 * 60;
export const HEATMAP_CACHE_CONTROL =
  `public, max-age=3600, s-maxage=${HEATMAP_TTL_SECONDS}, stale-while-revalidate=86400`;

export type HeatmapFeatureCollection = MerchantFeatureCollection;

export type StoredHeatmap = {
  collection: HeatmapFeatureCollection;
  generatedAt: string;
  featureCount: number;
};

export type HeatmapUploadResult = {
  blob: PutBlobResult;
  featureCount: number;
  generatedAt: string;
  byteLength: number;
};

export function canUseHeatmapBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function generateHeatmapCollection(): Promise<StoredHeatmap> {
  const features = await getHeatmapData();
  const collection: HeatmapFeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  return {
    collection,
    generatedAt: new Date().toISOString(),
    featureCount: features.length,
  };
}

export function serializeHeatmap(collection: HeatmapFeatureCollection): string {
  return JSON.stringify(collection);
}

export async function uploadHeatmapToBlob(
  collection: HeatmapFeatureCollection,
  generatedAt: string,
): Promise<HeatmapUploadResult> {
  const body = serializeHeatmap(collection);
  const blob = await put(HEATMAP_BLOB_PATHNAME, body, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/geo+json; charset=utf-8",
    cacheControlMaxAge: HEATMAP_TTL_SECONDS,
  });

  return {
    blob,
    featureCount: collection.features.length,
    generatedAt,
    byteLength: Buffer.byteLength(body),
  };
}

export async function regenerateHeatmapBlob(): Promise<HeatmapUploadResult> {
  const { collection, generatedAt } = await generateHeatmapCollection();
  return uploadHeatmapToBlob(collection, generatedAt);
}

export async function getStoredHeatmapBlob(
  ifNoneMatch?: string | null,
): Promise<GetBlobResult | null> {
  if (!canUseHeatmapBlobStore()) return null;

  return get(HEATMAP_BLOB_PATHNAME, {
    access: "private",
    ifNoneMatch: ifNoneMatch ?? undefined,
  });
}
