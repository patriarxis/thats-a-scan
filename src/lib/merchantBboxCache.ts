import type { PartnerFeature } from "@/types";
import type { BBoxPayload } from "@/lib/upHellasMerchants";
import { quantizeBboxToGrid } from "@/lib/merchantViewportTiles";

const BBOX_CACHE_TTL_MS = 20 * 60 * 1000;
const BBOX_CACHE_MAX_ENTRIES = 200;

type BboxCacheEntry = {
  features: PartnerFeature[];
  loadedAt: number;
};

const cache = new Map<string, BboxCacheEntry>();

function touchEntry(key: string, entry: BboxCacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

export function getCachedBboxFeatures(bbox: BBoxPayload): PartnerFeature[] | null {
  const key = quantizeBboxToGrid(bbox);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.loadedAt >= BBOX_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  touchEntry(key, entry);
  return entry.features;
}

export function setCachedBboxFeatures(bbox: BBoxPayload, features: PartnerFeature[]): void {
  const key = quantizeBboxToGrid(bbox);
  touchEntry(key, { features, loadedAt: Date.now() });
  while (cache.size > BBOX_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
