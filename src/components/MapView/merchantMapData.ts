import type { Map as MapboxMap } from "mapbox-gl";
import { getPartnerId, type PartnerFeature } from "@/types";
import {
  DECLUTTER_ZOOM_QUANTUM,
  DETAILED_MARKER_MIN_ZOOM,
  MARKER_DENSITY_STEPS,
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

/** Half-level steps (e.g. 11, 11.5, 12) so decluttering does not change every pinch tick. */
export const quantizeDeclutterZoom = (zoom: number): number => {
  const q = DECLUTTER_ZOOM_QUANTUM;
  return Math.round(zoom / q) * q;
};

export type MerchantDeclutterStickyState = {
  /** Last quantized zoom used for sticky cell keys and grid step. */
  zoomQuantum: number;
  /** Winner per geographic cell (stable while panning / small zoom wobble). */
  cellWinners: Map<string, string>;
};

const metersPerPixelApprox = (latitude: number, zoom: number): number => {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
};

const maxMarkerCountForZoom = (zoom: number): number => {
  if (zoom >= SHOW_ALL_MARKERS_ZOOM) return Number.POSITIVE_INFINITY;
  let maxCount = ZOOM_REVEAL_STEPS[0].maxCount;
  for (const step of ZOOM_REVEAL_STEPS) {
    if (zoom >= step.minZoom) maxCount = step.maxCount;
  }
  return maxCount;
};

const densityStepForZoom = (zoom: number) => {
  let density = MARKER_DENSITY_STEPS[0];
  for (const step of MARKER_DENSITY_STEPS) {
    if (zoom >= step.minZoom) density = step;
  }
  return density;
};

type MarkerState = "hidden" | "small" | "default";

const iconShareForZoom = (zoom: number): number => {
  if (zoom >= SHOW_ALL_MARKERS_ZOOM) return 1;
  if (zoom < DETAILED_MARKER_MIN_ZOOM) return 0.06;
  const progress =
    (zoom - DETAILED_MARKER_MIN_ZOOM) / (SHOW_ALL_MARKERS_ZOOM - DETAILED_MARKER_MIN_ZOOM);
  return 0.22 + progress * 0.58;
};

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

const isInCurrentViewport = (map: MapboxMap, feature: PartnerFeature): boolean => {
  const bounds = map.getBounds();
  if (!bounds) return true;
  const lng = Number(feature.geometry.coordinates[0]);
  const lat = Number(feature.geometry.coordinates[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) && bounds.contains([lng, lat]);
};

/** Reset sticky assignments when quantized zoom tier changes so density rules can rebuild. */
const syncDeclutterStickyQuantum = (sticky: MerchantDeclutterStickyState, zoomQuantum: number) => {
  if (sticky.zoomQuantum !== zoomQuantum) {
    sticky.zoomQuantum = zoomQuantum;
    sticky.cellWinners.clear();
  }
};

const GEO_STICKY_MAX_ENTRIES = 1200;

const pruneStickyBeyondLimit = (sticky: MerchantDeclutterStickyState): void => {
  if (sticky.cellWinners.size <= GEO_STICKY_MAX_ENTRIES) return;
  const keysToDelete = sticky.cellWinners.size - Math.floor(GEO_STICKY_MAX_ENTRIES * 0.6);
  let deleted = 0;
  for (const key of sticky.cellWinners.keys()) {
    if (deleted >= keysToDelete) break;
    sticky.cellWinners.delete(key);
    deleted += 1;
  }
};

const selectVisibleByStickyGeoGrid = (
  map: MapboxMap,
  ranked: PartnerFeature[],
  visibleBudget: number,
  zoomQuantum: number,
  alwaysKeep: ReadonlySet<string>,
  sticky: MerchantDeclutterStickyState,
): Set<string> => {
  syncDeclutterStickyQuantum(sticky, zoomQuantum);

  const visibleIds = new Set<string>();
  const bounds = map.getBounds();

  if (!bounds || zoomQuantum >= SHOW_ALL_MARKERS_ZOOM) {
    const fallback = pickPrioritizedUpTo(map, ranked, visibleBudget);
    fallback.forEach((feature) => visibleIds.add(getPartnerId(feature)));
    alwaysKeep.forEach((id) => visibleIds.add(id));
    return visibleIds;
  }

  const density = densityStepForZoom(zoomQuantum);
  const center = map.getCenter();
  const mpp = metersPerPixelApprox(center.lat, zoomQuantum);
  const metersPerLat = 111320;
  const latStepDeg = Math.max(
    (density.cellSizePx * mpp) / metersPerLat,
    8e-6,
  );
  const cosLat = Math.max(0.25, Math.cos((center.lat * Math.PI) / 180));
  const lngStepDeg = Math.max(
    (density.cellSizePx * mpp) / (metersPerLat * cosLat),
    8e-6,
  );

  const byCell = new Map<string, PartnerFeature[]>();
  for (const feature of ranked) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!bounds.contains([lng, lat])) continue;

    const latIdx = Math.floor(lat / latStepDeg);
    const lngIdx = Math.floor(lng / lngStepDeg);
    const cellKey = `${latIdx}:${lngIdx}`;
    const list = byCell.get(cellKey);
    if (!list) {
      byCell.set(cellKey, [feature]);
    } else {
      list.push(feature);
    }
  }

  const provisional = new Set<string>();
  const sortedCells = [...byCell.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  for (const cellKey of sortedCells) {
    const cands = byCell.get(cellKey);
    if (!cands?.length) continue;

    const picked: PartnerFeature[] = [];
    const pending = [...cands];
    const stickyId = sticky.cellWinners.get(cellKey);
    if (stickyId) {
      const match = pending.findIndex((f) => getPartnerId(f) === stickyId);
      if (match >= 0) {
        picked.push(pending[match]!);
        pending.splice(match, 1);
      }
    }

    while (picked.length < density.maxPerCell && pending.length > 0) {
      picked.push(pending.shift()!);
    }

    picked.forEach((f) => provisional.add(getPartnerId(f)));

    sticky.cellWinners.set(cellKey, getPartnerId(picked[0]!));
  }

  pruneStickyBeyondLimit(sticky);

  for (const feature of ranked) {
    if (visibleIds.size >= visibleBudget) break;
    const id = getPartnerId(feature);
    if (provisional.has(id)) {
      visibleIds.add(id);
    }
  }

  alwaysKeep.forEach((id) => visibleIds.add(id));
  return visibleIds;
};

/** Module default so `buildMerchantsFeatureCollection` callers get persistent sticky state without wiring a ref. */
const defaultDeclutterStickyForBuild: MerchantDeclutterStickyState = {
  zoomQuantum: Number.NaN,
  cellWinners: new Map(),
};

const assignMarkerStatesByZoom = (
  map: MapboxMap,
  features: PartnerFeature[],
  zoomRaw: number,
  sticky: MerchantDeclutterStickyState,
  alwaysKeepIds?: ReadonlySet<string>,
): PartnerFeature[] => {
  const zoomQuantum = quantizeDeclutterZoom(zoomRaw);
  const maxVisibleCount = maxMarkerCountForZoom(zoomQuantum);
  const ranked = stableRankByMerchantId(features);
  const alwaysKeep = alwaysKeepIds ?? new Set<string>();
  const visibleBudget = Number.isFinite(maxVisibleCount)
    ? Math.max(0, maxVisibleCount)
    : ranked.length;
  const visibleIds = selectVisibleByStickyGeoGrid(
    map,
    ranked,
    visibleBudget,
    zoomQuantum,
    alwaysKeep,
    sticky,
  );

  const visibleCount = Math.min(visibleIds.size, ranked.length);
  const iconBudget =
    zoomQuantum >= SHOW_ALL_MARKERS_ZOOM
      ? visibleCount
      : Math.min(
          visibleCount,
          Math.max(0, Math.floor(visibleCount * iconShareForZoom(zoomQuantum))),
        );

  const iconIds = new Set<string>();

  let assignedIcons = 0;
  for (const feature of ranked) {
    const id = getPartnerId(feature);
    if (!visibleIds.has(id)) continue;
    const isPriorityMarker = alwaysKeep.has(id);
    if (
      assignedIcons < iconBudget ||
      (isPriorityMarker && zoomQuantum >= DETAILED_MARKER_MIN_ZOOM)
    ) {
      iconIds.add(id);
      assignedIcons += 1;
    }
  }

  return ranked.map((feature) => {
    const id = getPartnerId(feature);
    let markerState: MarkerState = "hidden";
    if (visibleIds.has(id)) {
      markerState =
        iconIds.has(id) || (alwaysKeep.has(id) && isInCurrentViewport(map, feature))
          ? "default"
          : "small";
    }
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
  sticky: MerchantDeclutterStickyState = defaultDeclutterStickyForBuild,
) => {
  const dedupedItems = dedupeByMerchantId(items);
  const zoomCappedItems = assignMarkerStatesByZoom(
    map,
    dedupedItems,
    map.getZoom(),
    sticky,
    alwaysKeepIds,
  );
  return {
    type: "FeatureCollection" as const,
    features: withClientIds(zoomCappedItems),
  };
};
