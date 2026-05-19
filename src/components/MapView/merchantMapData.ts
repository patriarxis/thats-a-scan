import type { Map as MapboxMap } from "mapbox-gl";
import { getBufferedBoundsBox, pointInBoundsBox } from "@/lib/mapViewport";
import { getPartnerId, type PartnerFeature } from "@/types";
import {
  DECLUTTER_ZOOM_QUANTUM,
  declutterProfileForZoom,
  DETAILED_MARKER_MIN_ZOOM,
  usesGeoGridForZoom,
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

type MarkerState = "hidden" | "small" | "default";

const metersPerPixelApprox = (latitude: number, zoom: number): number => {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
};

const pickPrioritizedUpTo = (
  map: MapboxMap,
  features: PartnerFeature[],
  maxCount: number,
  zoom: number = map.getZoom(),
): PartnerFeature[] => {
  if (features.length <= maxCount) return features;

  const queryBounds = getBufferedBoundsBox(map, zoom);
  if (!queryBounds) return features.slice(0, maxCount);

  const inView: PartnerFeature[] = [];
  const outOfView: PartnerFeature[] = [];
  for (const feature of features) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      outOfView.push(feature);
      continue;
    }
    if (pointInBoundsBox(lng, lat, queryBounds)) inView.push(feature);
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

const isInBufferedBounds = (
  map: MapboxMap,
  feature: PartnerFeature,
  zoom: number,
): boolean => {
  const queryBounds = getBufferedBoundsBox(map, zoom);
  if (!queryBounds) return true;
  const lng = Number(feature.geometry.coordinates[0]);
  const lat = Number(feature.geometry.coordinates[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) && pointInBoundsBox(lng, lat, queryBounds);
};

/**
 * Street mode (no geo grid): pick full icons first, then dots from the remainder, then optional
 * overflow dots for merchants that would otherwise be hidden by the cap.
 */
const selectStreetModeVisible = (
  map: MapboxMap,
  ranked: PartnerFeature[],
  zoomQuantum: number,
  alwaysKeep: ReadonlySet<string>,
): { visibleIds: Set<string>; iconIds: Set<string> } => {
  const profile = declutterProfileForZoom(zoomQuantum);
  const iconBudget = Math.max(
    alwaysKeep.size,
    Math.floor(profile.maxVisible * profile.iconShare),
  );
  const dotBudget = Math.max(0, profile.maxVisible - iconBudget);
  const dotOverflowBudget = profile.maxDotOverflow ?? 0;

  const mustIcon: PartnerFeature[] = [];
  const pool: PartnerFeature[] = [];
  const seenMust = new Set<string>();
  for (const feature of ranked) {
    const id = getPartnerId(feature);
    if (alwaysKeep.has(id)) {
      if (!seenMust.has(id)) {
        seenMust.add(id);
        mustIcon.push(feature);
      }
    } else {
      pool.push(feature);
    }
  }

  const iconFromPool = pickPrioritizedUpTo(
    map,
    pool,
    Math.max(0, iconBudget - mustIcon.length),
    zoomQuantum,
  );
  const iconIds = new Set<string>([
    ...mustIcon.map((f) => getPartnerId(f)),
    ...iconFromPool.map((f) => getPartnerId(f)),
  ]);

  const visibleIds = new Set<string>(iconIds);
  const afterIcons = ranked.filter((f) => !iconIds.has(getPartnerId(f)));
  const dotPicks = pickPrioritizedUpTo(map, afterIcons, dotBudget, zoomQuantum);
  dotPicks.forEach((f) => visibleIds.add(getPartnerId(f)));

  if (dotOverflowBudget > 0) {
    const overflowPool = ranked.filter((f) => {
      const id = getPartnerId(f);
      return !visibleIds.has(id) && isInBufferedBounds(map, f, zoomQuantum);
    });
    const overflowDots = pickPrioritizedUpTo(
      map,
      overflowPool,
      dotOverflowBudget,
      zoomQuantum,
    );
    overflowDots.forEach((f) => visibleIds.add(getPartnerId(f)));
  }

  alwaysKeep.forEach((id) => visibleIds.add(id));
  return { visibleIds, iconIds };
};

/** Reset sticky assignments when quantized zoom tier changes so density rules can rebuild. */
const syncDeclutterStickyQuantum = (sticky: MerchantDeclutterStickyState, zoomQuantum: number) => {
  if (sticky.zoomQuantum !== zoomQuantum) {
    sticky.zoomQuantum = zoomQuantum;
    sticky.cellWinners.clear();
  }
};

const GEO_STICKY_MAX_ENTRIES = 1200;

/**
 * Cell sizes must NOT depend on the moving viewport center.
 * If we used `map.getCenter().lat`, every pan would change `cos(lat)`, which would shift the
 * lat/lng step degrees and therefore the integer cell keys — invalidating every sticky winner.
 * Pinning the reference latitude to Greece's median keeps cell coordinates pan-invariant within a zoom quantum.
 */
const DECLUTTER_REFERENCE_LAT = 38;

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
  const queryBounds = bounds ? getBufferedBoundsBox(map, zoomQuantum) : null;

  if (!bounds || !usesGeoGridForZoom(zoomQuantum)) {
    return visibleIds;
  }

  const profile = declutterProfileForZoom(zoomQuantum);
  const cellSizePx = profile.cellSizePx!;
  const mpp = metersPerPixelApprox(DECLUTTER_REFERENCE_LAT, zoomQuantum);
  const metersPerLat = 111320;
  const latStepDeg = Math.max(
    (cellSizePx * mpp) / metersPerLat,
    8e-6,
  );
  const cosLat = Math.max(
    0.25,
    Math.cos((DECLUTTER_REFERENCE_LAT * Math.PI) / 180),
  );
  const lngStepDeg = Math.max(
    (cellSizePx * mpp) / (metersPerLat * cosLat),
    8e-6,
  );

  const byCell = new Map<string, PartnerFeature[]>();
  for (const feature of ranked) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!queryBounds || !pointInBoundsBox(lng, lat, queryBounds)) continue;

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

    while (picked.length < profile.maxPerCell && pending.length > 0) {
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

/**
 * Marker visibility pipeline (upstream filters run before this in MapView / useMap):
 * 1. Eligibility — partners already scoped by viewport buffer (useMap) and optional product filter.
 * 2. Dedupe — `dedupeByMerchantId`.
 * 3. Spatial + budget — geo grid (`usesGeoGridForZoom`) then `maxVisible` from `DECLUTTER_PROFILE_BY_ZOOM`.
 * 4. Visual weight — `iconShare` splits visible pins into full icons vs dots; street mode also uses `maxDotOverflow` for capped merchants.
 */
const assignMarkerStatesByZoom = (
  map: MapboxMap,
  features: PartnerFeature[],
  zoomRaw: number,
  sticky: MerchantDeclutterStickyState,
  alwaysKeepIds?: ReadonlySet<string>,
): PartnerFeature[] => {
  const zoomQuantum = quantizeDeclutterZoom(zoomRaw);
  const profile = declutterProfileForZoom(zoomRaw);
  const ranked = stableRankByMerchantId(features);
  const alwaysKeep = alwaysKeepIds ?? new Set<string>();

  let visibleIds: Set<string>;
  let iconIds: Set<string>;

  if (!usesGeoGridForZoom(zoomRaw)) {
    const street = selectStreetModeVisible(map, ranked, zoomQuantum, alwaysKeep);
    visibleIds = street.visibleIds;
    iconIds = new Set(street.iconIds);
    for (const feature of ranked) {
      const id = getPartnerId(feature);
      if (
        alwaysKeep.has(id) &&
        zoomQuantum >= DETAILED_MARKER_MIN_ZOOM &&
        isInCurrentViewport(map, feature)
      ) {
        iconIds.add(id);
      }
    }
  } else {
    const visibleBudget = Math.max(0, profile.maxVisible);
    visibleIds = selectVisibleByStickyGeoGrid(
      map,
      ranked,
      visibleBudget,
      zoomQuantum,
      alwaysKeep,
      sticky,
    );

    const visibleCount = Math.min(visibleIds.size, ranked.length);
    const iconBudget = Math.min(
      visibleCount,
      Math.max(0, Math.floor(visibleCount * profile.iconShare)),
    );

    iconIds = new Set<string>();
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
