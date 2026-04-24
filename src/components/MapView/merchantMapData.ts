import type { Map as MapboxMap } from "mapbox-gl";
import { getPartnerId, type PartnerFeature } from "@/types";
import {
  DETAILED_MARKER_MIN_ZOOM,
  SHOW_ALL_MARKERS_ZOOM,
  ZOOM_REVEAL_STEPS,
} from "./mapViewConstants";
import { withClientIds } from "./merchantMarkerVisual";

export const dedupeByMerchantId = (features: PartnerFeature[]): PartnerFeature[] => {
  const byId = new Map<string, PartnerFeature>();
  for (const feature of features) {
    const rawId = String(
      feature.properties.ID ??
        feature.properties.MerchantId ??
        feature.properties.mongo_id ??
        "",
    )
      .trim()
      .toLowerCase();
    const name = String(
      feature.properties.BrandName_EN ??
        feature.properties.BrandNameEN ??
        feature.properties.BrandName_GR ??
        feature.properties.BrandNameGR ??
        feature.properties.VATName_EN ??
        feature.properties.VATNameEN ??
        feature.properties.VATName_GR ??
        feature.properties.VATNameGR ??
        "",
    )
      .trim()
      .toLowerCase();
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    const coordKey =
      Number.isFinite(lng) && Number.isFinite(lat)
        ? `${lng.toFixed(5)}:${lat.toFixed(5)}`
        : getPartnerId(feature).trim().toLowerCase();
    const dedupeKey = rawId ? `${rawId}|${coordKey}` : name ? `${name}|${coordKey}` : coordKey;
    if (!byId.has(dedupeKey)) {
      byId.set(dedupeKey, feature);
    }
  }
  return Array.from(byId.values());
};

const maxMarkerCountForZoom = (zoom: number): number => {
  if (zoom >= SHOW_ALL_MARKERS_ZOOM) return Number.POSITIVE_INFINITY;
  let maxCount = ZOOM_REVEAL_STEPS[0].maxCount;
  for (const step of ZOOM_REVEAL_STEPS) {
    if (zoom >= step.minZoom) maxCount = step.maxCount;
  }
  return maxCount;
};

type MarkerState = "hidden" | "small" | "default";

const iconShareForZoom = (zoom: number): number => {
  if (zoom >= SHOW_ALL_MARKERS_ZOOM) return 1;
  if (zoom < DETAILED_MARKER_MIN_ZOOM) return 0.06;
  const progress =
    (zoom - DETAILED_MARKER_MIN_ZOOM) / (SHOW_ALL_MARKERS_ZOOM - DETAILED_MARKER_MIN_ZOOM);
  return 0.22 + progress * 0.58;
};

/**
 * Prefer pins inside the viewport, but never drop an on-screen pin to make room for off-screen ones.
 */
const pickPrioritizedUpTo = (map: MapboxMap, features: PartnerFeature[], maxCount: number): PartnerFeature[] => {
  if (features.length <= maxCount) return features;

  const bounds = map.getBounds();
  if (!bounds) return features.slice(0, maxCount);

  const inView: PartnerFeature[] = [];
  const outOfView: PartnerFeature[] = [];
  for (const feature of features) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      outOfView.push(feature);
      continue;
    }
    if (bounds.contains([lng, lat])) inView.push(feature);
    else outOfView.push(feature);
  }

  if (inView.length >= maxCount) {
    return inView.slice(0, maxCount);
  }
  return [...inView, ...outOfView.slice(0, maxCount - inView.length)];
};

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stableRankByMerchantId = (features: PartnerFeature[]): PartnerFeature[] => {
  return [...features].sort((a, b) => {
    const aId = getPartnerId(a).trim().toLowerCase();
    const bId = getPartnerId(b).trim().toLowerCase();
    const aHash = stableHash(aId);
    const bHash = stableHash(bId);
    if (aHash !== bHash) return aHash - bHash;
    return aId.localeCompare(bId);
  });
};

const assignMarkerStatesByZoom = (
  features: PartnerFeature[],
  zoom: number,
  alwaysKeepIds?: ReadonlySet<string>,
): PartnerFeature[] => {
  const maxVisibleCount = maxMarkerCountForZoom(zoom);
  const ranked = stableRankByMerchantId(features);
  const maxIndexForVisible = ranked.length;
  const iconBudget =
    zoom >= SHOW_ALL_MARKERS_ZOOM
      ? ranked.length
      : Math.min(
          Number.isFinite(maxVisibleCount) ? maxVisibleCount : ranked.length,
          Math.max(0, Math.floor(maxIndexForVisible * iconShareForZoom(zoom))),
        );

  const alwaysKeep = alwaysKeepIds ?? new Set<string>();
  const visibleIds = new Set<string>();
  const iconIds = new Set<string>();

  for (let i = 0; i < ranked.length; i++) {
    const id = getPartnerId(ranked[i]);
    if (i < maxIndexForVisible || alwaysKeep.has(id)) visibleIds.add(id);
    if (i < iconBudget || (alwaysKeep.has(id) && zoom >= DETAILED_MARKER_MIN_ZOOM)) iconIds.add(id);
  }

  return ranked.map((feature) => {
    const id = getPartnerId(feature);
    const markerState: MarkerState = visibleIds.has(id) && iconIds.has(id) ? "default" : "small";
    return {
      ...feature,
      properties: {
        ...feature.properties,
        __marker_state: markerState,
      },
    };
  });
};

export const prioritizeAndCapByZoom = (
  map: MapboxMap,
  features: PartnerFeature[],
  zoom: number,
  alwaysKeepIds?: ReadonlySet<string>,
): PartnerFeature[] => {
  const maxCount = maxMarkerCountForZoom(zoom);

  if (!alwaysKeepIds?.size) {
    return pickPrioritizedUpTo(map, features, maxCount);
  }

  const mustKeep: PartnerFeature[] = [];
  const seenMust = new Set<string>();
  const pool: PartnerFeature[] = [];
  for (const feature of features) {
    const id = getPartnerId(feature);
    if (alwaysKeepIds.has(id)) {
      if (!seenMust.has(id)) {
        seenMust.add(id);
        mustKeep.push(feature);
      }
    } else {
      pool.push(feature);
    }
  }

  const budget = Math.max(0, maxCount - mustKeep.length);
  return [...mustKeep, ...pickPrioritizedUpTo(map, pool, budget)];
};

export const buildMerchantsFeatureCollection = (
  map: MapboxMap,
  items: PartnerFeature[],
  alwaysKeepIds?: ReadonlySet<string>,
) => {
  const dedupedItems = dedupeByMerchantId(items);
  const zoom = map.getZoom();
  const zoomCappedItems = assignMarkerStatesByZoom(dedupedItems, zoom, alwaysKeepIds);
  return {
    type: "FeatureCollection" as const,
    features: withClientIds(zoomCappedItems),
  };
};
