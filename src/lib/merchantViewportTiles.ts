import {
  GREECE_UP_HELLAS_BOUNDS,
  type BBoxPayload,
} from "@/lib/upHellasMerchants";
import { pointInBoundsBox, type MapBoundsBox } from "@/lib/mapViewport";
import {
  BASE_TILE_DEG,
  FETCH_ZOOM_THRESHOLD,
  INITIAL_FOCUS_ZOOM,
  MAP_MAX_LAT_SPAN,
  MAP_MAX_LNG_SPAN,
  MAX_FETCHES_PER_TRIGGER_HIGH_ZOOM,
  MAX_FETCHES_PER_TRIGGER_LOW_ZOOM,
  MAX_TILES_FOR_BACKFILL,
  MAX_TILES_FOR_GRID_FETCH,
  MIN_ZOOM_FOR_VIEWPORT_FETCH,
  OVERVIEW_BLEND_ZOOM_END,
  OVERVIEW_BLEND_ZOOM_START,
  OVERVIEW_GRID_DECIMALS,
  OVERVIEW_MAX_DISPLAY_FEATURES,
} from "@/lib/config";
import type { MerchantFeature } from "@/types";

/** Single-request national sample for zoomed-out / hotspot preview (not a full catalogue crawl). */
export const GREECE_OVERVIEW_BBOX: BBoxPayload = {
  north_west: {
    latitude: GREECE_UP_HELLAS_BOUNDS.north,
    longitude: GREECE_UP_HELLAS_BOUNDS.west,
  },
  south_east: {
    latitude: GREECE_UP_HELLAS_BOUNDS.south,
    longitude: GREECE_UP_HELLAS_BOUNDS.east,
  },
};

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** 0 = street detail only, 1 = full national overview treatment. */
export const overviewDisplayWeight = (
  zoom: number,
  viewportTooWide: boolean,
): number => {
  if (viewportTooWide) return 1;
  if (zoom >= OVERVIEW_BLEND_ZOOM_START) return 0;
  if (zoom <= OVERVIEW_BLEND_ZOOM_END) return 1;
  return (
    (OVERVIEW_BLEND_ZOOM_START - zoom) /
    (OVERVIEW_BLEND_ZOOM_START - OVERVIEW_BLEND_ZOOM_END)
  );
};

export const shouldUseOverviewLayer = (
  zoom: number,
  viewportTooWide: boolean,
): boolean => overviewDisplayWeight(zoom, viewportTooWide) > 0;

/** High-priority street-level fetch for the map center (overview / zoomed-out modes). */
export function planFocusDetailFetch(
  box: MapBoundsBox,
  zoom: number,
  fetched: Set<string>,
): PlannedBbox[] {
  if (zoom < 10) return [];
  const lat = (box.north + box.south) / 2;
  const lng = (box.east + box.west) / 2;
  const focusZoom = Math.min(Math.max(zoom, 14), INITIAL_FOCUS_ZOOM);
  const bbox = bboxForViewportAtZoom(lng, lat, focusZoom);
  const tileKeys = tileKeysCoveringBox(bboxToBoundsBox(bbox), 0);
  if (tileKeys.length > 0 && tileKeys.every((key) => fetched.has(key))) {
    return [];
  }
  return [{ bbox, tileKeys, priority: -1 }];
};

export function downsampleForMapOverview(
  features: MerchantFeature[],
  maxFeatures: number = OVERVIEW_MAX_DISPLAY_FEATURES,
  gridDecimals: number = OVERVIEW_GRID_DECIMALS,
): MerchantFeature[] {
  if (features.length <= maxFeatures) return features;
  const byGrid = new Map<string, MerchantFeature>();
  for (const feature of features) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const key = `${lat.toFixed(gridDecimals)}:${lng.toFixed(gridDecimals)}`;
    if (!byGrid.has(key)) byGrid.set(key, feature);
  }
  const compact = Array.from(byGrid.values());
  if (compact.length <= maxFeatures) return compact;
  const step = Math.ceil(compact.length / maxFeatures);
  return compact.filter((_, index) => index % step === 0).slice(0, maxFeatures);
}

const DETAIL_DISPLAY_CAP = 3200;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Spread pins across the visible map area as hotspots (not a fixed degree grid).
 * A city-sized view at z12 keeps dozens of pins; country view keeps hundreds.
 */
export function downsampleForViewportHotspots(
  features: MerchantFeature[],
  box: MapBoundsBox,
  zoom: number,
  viewportTooWide: boolean,
): MerchantFeature[] {
  const weight = overviewDisplayWeight(zoom, viewportTooWide);
  if (weight <= 0 || features.length === 0) return features;

  const latSpan = Math.max(0.012, Math.abs(box.north - box.south));
  const lngSpan = Math.max(0.012, Math.abs(box.east - box.west));
  const aspect = latSpan / lngSpan;

  const minHotspots = Math.round(lerp(180, 64, weight));
  const maxHotspots = Math.round(lerp(DETAIL_DISPLAY_CAP, 420, weight));
  const cellAreaTarget = lerp(0.0009, 0.022, weight);
  const estimated = Math.ceil((latSpan * lngSpan) / cellAreaTarget);
  const targetHotspots = clamp(estimated, minHotspots, maxHotspots);

  const cols = Math.max(1, Math.ceil(Math.sqrt(targetHotspots * aspect)));
  const rows = Math.max(1, Math.ceil(targetHotspots / cols));
  const latStep = latSpan / rows;
  const lngStep = lngSpan / cols;
  const latDecimals = Math.min(3, Math.max(2, Math.ceil(-Math.log10(latStep)) || 2));
  const lngDecimals = Math.min(3, Math.max(2, Math.ceil(-Math.log10(lngStep)) || 2));

  const byGrid = new Map<string, MerchantFeature>();
  for (const feature of features) {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const key = `${lat.toFixed(latDecimals)}:${lng.toFixed(lngDecimals)}`;
    if (!byGrid.has(key)) byGrid.set(key, feature);
  }

  const compact = Array.from(byGrid.values());
  if (compact.length <= maxHotspots) return compact;
  const step = Math.ceil(compact.length / maxHotspots);
  return compact.filter((_, index) => index % step === 0).slice(0, maxHotspots);
}

const DEFAULT_MAP_CENTER: [number, number] = [23.7275, 37.9838];

const INITIAL_VIEWPORT_WIDTH_PX = 900;
const INITIAL_VIEWPORT_HEIGHT_PX = 700;
const INITIAL_BBOX_BUFFER_FRACTION = 0.25;

export const MAX_FETCH_LAT_SPAN = 0.35;
export const MAX_FETCH_LNG_SPAN = 0.45;

export type PlannedBbox = {
  bbox: BBoxPayload;
  tileKeys: string[];
  priority: number;
};

const degreesPerPixelAtZoom = (zoom: number): number =>
  360 / (256 * 2 ** zoom);

export const halfSpansForViewportZoom = (
  zoom: number,
  lat: number,
  bufferFraction = INITIAL_BBOX_BUFFER_FRACTION,
): { latHalfSpan: number; lngHalfSpan: number } => {
  const latDegPerPx = degreesPerPixelAtZoom(zoom);
  const lngDegPerPx = latDegPerPx / Math.cos((lat * Math.PI) / 180);
  const bufferScale = 1 + bufferFraction;
  return {
    latHalfSpan: (INITIAL_VIEWPORT_HEIGHT_PX / 2) * latDegPerPx * bufferScale,
    lngHalfSpan: (INITIAL_VIEWPORT_WIDTH_PX / 2) * lngDegPerPx * bufferScale,
  };
};

export const maxFetchesPerTrigger = (zoom: number): number =>
  zoom >= FETCH_ZOOM_THRESHOLD
    ? MAX_FETCHES_PER_TRIGGER_HIGH_ZOOM
    : MAX_FETCHES_PER_TRIGGER_LOW_ZOOM;

export type ViewportFetchMode = "none" | "bbox" | "tiles";

export const isMapSpanTooWide = (box: MapBoundsBox): boolean => {
  const { latSpan, lngSpan } = spanOfBox(box);
  return latSpan > MAP_MAX_LAT_SPAN || lngSpan > MAP_MAX_LNG_SPAN;
};

export const viewportFetchMode = (zoom: number, box: MapBoundsBox): ViewportFetchMode => {
  if (zoom < MIN_ZOOM_FOR_VIEWPORT_FETCH || isMapSpanTooWide(box)) {
    return "none";
  }
  const tileCount = tileKeysCoveringBox(box, 1).length;
  if (zoom >= FETCH_ZOOM_THRESHOLD && tileCount <= MAX_TILES_FOR_GRID_FETCH) {
    return "tiles";
  }
  return "bbox";
};

export const clampBoundsBoxToMaxFetch = (box: MapBoundsBox): MapBoundsBox => {
  const { latSpan, lngSpan } = spanOfBox(box);
  if (latSpan <= MAX_FETCH_LAT_SPAN && lngSpan <= MAX_FETCH_LNG_SPAN) {
    return box;
  }
  const centerLat = (box.north + box.south) / 2;
  const centerLng = (box.east + box.west) / 2;
  const halfLat = Math.min(latSpan / 2, MAX_FETCH_LAT_SPAN / 2);
  const halfLng = Math.min(lngSpan / 2, MAX_FETCH_LNG_SPAN / 2);
  return {
    north: centerLat + halfLat,
    south: centerLat - halfLat,
    east: centerLng + halfLng,
    west: centerLng - halfLng,
  };
};

export const boundsBoxToBBox = (box: MapBoundsBox): BBoxPayload => ({
  north_west: { latitude: box.north, longitude: box.west },
  south_east: { latitude: box.south, longitude: box.east },
});

export const bboxToBoundsBox = (bbox: BBoxPayload): MapBoundsBox => ({
  north: bbox.north_west.latitude,
  south: bbox.south_east.latitude,
  west: bbox.north_west.longitude,
  east: bbox.south_east.longitude,
});

export const bboxFromCenter = (
  lng: number,
  lat: number,
  latHalfSpan: number,
  lngHalfSpan: number,
): BBoxPayload => ({
  north_west: { latitude: lat + latHalfSpan, longitude: lng - lngHalfSpan },
  south_east: { latitude: lat - latHalfSpan, longitude: lng + lngHalfSpan },
});

export const bboxForViewportAtZoom = (
  lng: number,
  lat: number,
  zoom: number = INITIAL_FOCUS_ZOOM,
): BBoxPayload => {
  const { latHalfSpan, lngHalfSpan } = halfSpansForViewportZoom(zoom, lat);
  return bboxFromCenter(lng, lat, latHalfSpan, lngHalfSpan);
};

export const defaultInitialCatalogueBbox = (): BBoxPayload =>
  bboxForViewportAtZoom(DEFAULT_MAP_CENTER[0], DEFAULT_MAP_CENTER[1]);

export const initialCatalogueBboxForLocation = (
  location: { lng: number; lat: number } | null,
  zoom: number = INITIAL_FOCUS_ZOOM,
): BBoxPayload => {
  const lng = location?.lng ?? DEFAULT_MAP_CENTER[0];
  const lat = location?.lat ?? DEFAULT_MAP_CENTER[1];
  return bboxForViewportAtZoom(lng, lat, zoom);
};

const spanOfBox = (box: MapBoundsBox): { latSpan: number; lngSpan: number } => ({
  latSpan: Math.abs(box.north - box.south),
  lngSpan: Math.abs(box.east - box.west),
});

export const tileKeyFromIndices = (latIdx: number, lngIdx: number): string =>
  `${latIdx}:${lngIdx}`;

export const parseTileKey = (key: string): { latIdx: number; lngIdx: number } => {
  const [lat, lng] = key.split(":").map(Number);
  return { latIdx: lat!, lngIdx: lng! };
};

export const boundsForTileKey = (key: string): MapBoundsBox => {
  const { latIdx, lngIdx } = parseTileKey(key);
  return {
    north: (latIdx + 1) * BASE_TILE_DEG,
    south: latIdx * BASE_TILE_DEG,
    west: lngIdx * BASE_TILE_DEG,
    east: (lngIdx + 1) * BASE_TILE_DEG,
  };
};

export const tileKeysCoveringBox = (
  box: MapBoundsBox,
  neighborPadding = 0,
): string[] => {
  const minLatIdx = Math.floor(box.south / BASE_TILE_DEG) - neighborPadding;
  const maxLatIdx = Math.floor(box.north / BASE_TILE_DEG) + neighborPadding;
  const minLngIdx = Math.floor(box.west / BASE_TILE_DEG) - neighborPadding;
  const maxLngIdx = Math.floor(box.east / BASE_TILE_DEG) + neighborPadding;
  const keys: string[] = [];
  for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx += 1) {
    for (let lngIdx = minLngIdx; lngIdx <= maxLngIdx; lngIdx += 1) {
      keys.push(tileKeyFromIndices(latIdx, lngIdx));
    }
  }
  return keys;
};

export const boundsForTileKeys = (keys: string[]): MapBoundsBox => {
  let north = -Infinity;
  let south = Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const key of keys) {
    const box = boundsForTileKey(key);
    north = Math.max(north, box.north);
    south = Math.min(south, box.south);
    west = Math.min(west, box.west);
    east = Math.max(east, box.east);
  }
  return { north, south, west, east };
};

export const bboxesIntersect = (a: BBoxPayload, b: MapBoundsBox): boolean => {
  const box = bboxToBoundsBox(a);
  return !(
    box.south > b.north ||
    box.north < b.south ||
    box.east < b.west ||
    box.west > b.east
  );
};

const clusterTileKeys = (
  keys: string[],
  maxLatSpan: number,
  maxLngSpan: number,
): string[][] => {
  if (keys.length === 0) return [];
  const remaining = new Set(keys);
  const clusters: string[][] = [];

  while (remaining.size > 0) {
    const seed = remaining.values().next().value as string;
    remaining.delete(seed);
    const cluster = [seed];
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of [...remaining]) {
        const nextKeys = [...cluster, candidate];
        const nextSpan = spanOfBox(boundsForTileKeys(nextKeys));
        if (nextSpan.latSpan <= maxLatSpan && nextSpan.lngSpan <= maxLngSpan) {
          cluster.push(candidate);
          remaining.delete(candidate);
          grew = true;
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
};

const bboxCenter = (bbox: BBoxPayload): { lat: number; lng: number } => {
  const box = bboxToBoundsBox(bbox);
  return {
    lat: (box.north + box.south) / 2,
    lng: (box.east + box.west) / 2,
  };
};

export const sortPlannedBboxesByPriority = (
  planned: PlannedBbox[],
  viewportCenter: { lat: number; lng: number },
): PlannedBbox[] =>
  [...planned].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const centerA = bboxCenter(a.bbox);
    const centerB = bboxCenter(b.bbox);
    const dA =
      (centerA.lat - viewportCenter.lat) ** 2 +
      (centerA.lng - viewportCenter.lng) ** 2;
    const dB =
      (centerB.lat - viewportCenter.lat) ** 2 +
      (centerB.lng - viewportCenter.lng) ** 2;
    return dA - dB;
  });

export const backfillFetchedTilesFromStore = (
  box: MapBoundsBox,
  store: Iterable<MerchantFeature>,
  fetched: Set<string>,
): number => {
  const keys = tileKeysCoveringBox(box, 0);
  if (keys.length === 0 || keys.length > MAX_TILES_FOR_BACKFILL) return 0;

  const pending = new Set(keys.filter((key) => !fetched.has(key)));
  if (pending.size === 0) return 0;

  let added = 0;
  for (const feature of store) {
    if (pending.size === 0) break;
    const lng = feature.geometry.coordinates[0];
    const lat = feature.geometry.coordinates[1];
    const latIdx = Math.floor(lat / BASE_TILE_DEG);
    const lngIdx = Math.floor(lng / BASE_TILE_DEG);
    const key = tileKeyFromIndices(latIdx, lngIdx);
    if (pending.has(key)) {
      fetched.add(key);
      pending.delete(key);
      added += 1;
    }
  }
  return added;
};

export const isViewportSatisfied = (
  box: MapBoundsBox,
  fetched: Set<string>,
  options?: { zoom?: number; neighborPadding?: number },
): boolean => {
  const zoom = options?.zoom ?? FETCH_ZOOM_THRESHOLD;
  const neighborPadding = options?.neighborPadding ?? 1;
  const mode = viewportFetchMode(zoom, box);
  if (mode === "none") return true;

  const needed = tileKeysCoveringBox(
    box,
    mode === "tiles" ? neighborPadding : 0,
  );
  if (needed.length === 0) return true;
  return needed.every((key) => fetched.has(key));
};

export function planViewportFetches(
  box: MapBoundsBox,
  zoom: number,
  fetched: Set<string>,
  options?: { neighborPadding?: number; priority?: number; maxFetches?: number },
): PlannedBbox[] {
  const mode = viewportFetchMode(zoom, box);
  if (mode === "none") return [];

  const priority = options?.priority ?? 0;
  const maxFetches = options?.maxFetches ?? maxFetchesPerTrigger(zoom);
  // Medium zoom / wide tile grids: no neighbor ring (avoids hundreds of cells).
  const neighborPadding =
    options?.neighborPadding ?? (mode === "tiles" ? 1 : 0);

  const missingKeys = tileKeysCoveringBox(box, neighborPadding).filter(
    (key) => !fetched.has(key),
  );
  if (missingKeys.length === 0) return [];

  const clusters = clusterTileKeys(missingKeys, MAX_FETCH_LAT_SPAN, MAX_FETCH_LNG_SPAN);
  return clusters.slice(0, maxFetches).map((keys) => ({
    bbox: boundsBoxToBBox(boundsForTileKeys(keys)),
    tileKeys: keys,
    priority,
  }));
}

export function leadingEdgeTileKeys(
  box: MapBoundsBox,
  movement: { dLat: number; dLng: number },
): string[] {
  const { dLat, dLng } = movement;
  if (Math.hypot(dLat, dLng) < 1e-7) return [];

  const latStep = dLat > 0 ? 1 : dLat < 0 ? -1 : 0;
  const lngStep = dLng > 0 ? 1 : dLng < 0 ? -1 : 0;

  const minLatIdx = Math.floor(box.south / BASE_TILE_DEG);
  const maxLatIdx = Math.floor(box.north / BASE_TILE_DEG);
  const minLngIdx = Math.floor(box.west / BASE_TILE_DEG);
  const maxLngIdx = Math.floor(box.east / BASE_TILE_DEG);

  const keys: string[] = [];
  if (latStep > 0) {
    const latIdx = maxLatIdx + 1;
    for (let lngIdx = minLngIdx - 1; lngIdx <= maxLngIdx + 1; lngIdx += 1) {
      keys.push(tileKeyFromIndices(latIdx, lngIdx));
    }
  } else if (latStep < 0) {
    const latIdx = minLatIdx - 1;
    for (let lngIdx = minLngIdx - 1; lngIdx <= maxLngIdx + 1; lngIdx += 1) {
      keys.push(tileKeyFromIndices(latIdx, lngIdx));
    }
  }
  if (lngStep > 0) {
    const lngIdx = maxLngIdx + 1;
    for (let latIdx = minLatIdx - 1; latIdx <= maxLatIdx + 1; latIdx += 1) {
      keys.push(tileKeyFromIndices(latIdx, lngIdx));
    }
  } else if (lngStep < 0) {
    const lngIdx = minLngIdx - 1;
    for (let latIdx = minLatIdx - 1; latIdx <= maxLatIdx + 1; latIdx += 1) {
      keys.push(tileKeyFromIndices(latIdx, lngIdx));
    }
  }
  return [...new Set(keys)];
}

export function planLeadingEdgeFetches(
  box: MapBoundsBox,
  zoom: number,
  movement: { dLat: number; dLng: number },
  fetched: Set<string>,
): PlannedBbox[] {
  if (viewportFetchMode(zoom, box) !== "tiles") return [];

  const edgeKeys = leadingEdgeTileKeys(box, movement).filter((key) => !fetched.has(key));
  if (edgeKeys.length === 0) return [];

  const clusters = clusterTileKeys(edgeKeys, MAX_FETCH_LAT_SPAN, MAX_FETCH_LNG_SPAN);
  return clusters.slice(0, 3).map((keys) => ({
    bbox: boundsBoxToBBox(boundsForTileKeys(keys)),
    tileKeys: keys,
    priority: 1,
  }));
}

export const markTilesFetched = (keys: string[], fetched: Set<string>): void => {
  for (const key of keys) fetched.add(key);
};

export const markTilesFetchedForBbox = (bbox: BBoxPayload, fetched: Set<string>): void => {
  markTilesFetched(tileKeysCoveringBox(bboxToBoundsBox(bbox), 0), fetched);
};

export const quantizeBboxToGrid = (bbox: BBoxPayload): string => {
  const box = bboxToBoundsBox(bbox);
  const minLatIdx = Math.floor(box.south / BASE_TILE_DEG);
  const maxLatIdx = Math.floor(box.north / BASE_TILE_DEG);
  const minLngIdx = Math.floor(box.west / BASE_TILE_DEG);
  const maxLngIdx = Math.floor(box.east / BASE_TILE_DEG);
  return `${minLatIdx}:${maxLatIdx}:${minLngIdx}:${maxLngIdx}`;
};
