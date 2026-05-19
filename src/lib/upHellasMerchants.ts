import type { PartnerFeature } from "@/types";

const UP_HELLAS_API_URL = "https://merchants-map.uphellas.gr/geojson/search";
const UP_HELLAS_DENSE_RESULT_THRESHOLD = 2000;
const UP_HELLAS_MAX_SPLIT_DEPTH = 8;
const UP_HELLAS_MIN_LAT_SPAN = 0.005;
const UP_HELLAS_MIN_LNG_SPAN = 0.005;
const UP_HELLAS_MAX_REQUESTS_PER_CALL = 160;
const UP_HELLAS_REQUEST_CONCURRENCY = 8;

export const GREECE_UP_HELLAS_BOUNDS: Bounds = {
  north: 42.2,
  west: 18.5,
  south: 34.5,
  east: 30.5,
};

export type BBoxPayload = {
  north_west: {
    latitude: number;
    longitude: number;
  };
  south_east: {
    latitude: number;
    longitude: number;
  };
};

export type Bounds = {
  north: number;
  west: number;
  south: number;
  east: number;
};

type BoundsQueueItem = {
  bounds: Bounds;
  depth: number;
};

type UpHellasFetchState = {
  queue: BoundsQueueItem[];
  featuresByKey: Map<string, PartnerFeature>;
  requestCount: number;
  saturatedBounds: BoundsQueueItem[];
  stoppedByRequestLimit: boolean;
};

export type UpHellasFetchResult = {
  features: PartnerFeature[];
  requestCount: number;
  saturatedBoundsCount: number;
  stoppedByRequestLimit: boolean;
  complete: boolean;
};

export function payloadToBounds(payload: BBoxPayload): Bounds {
  return {
    north: payload.north_west.latitude,
    west: payload.north_west.longitude,
    south: payload.south_east.latitude,
    east: payload.south_east.longitude,
  };
}

function boundsToPayload(bounds: Bounds): BBoxPayload {
  return {
    north_west: {
      latitude: bounds.north,
      longitude: bounds.west,
    },
    south_east: {
      latitude: bounds.south,
      longitude: bounds.east,
    },
  };
}

function splitBounds(bounds: Bounds): Bounds[] {
  const midLat = (bounds.north + bounds.south) / 2;
  const midLng = (bounds.west + bounds.east) / 2;

  return [
    { north: bounds.north, west: bounds.west, south: midLat, east: midLng },
    { north: bounds.north, west: midLng, south: midLat, east: bounds.east },
    { north: midLat, west: bounds.west, south: bounds.south, east: midLng },
    { north: midLat, west: midLng, south: bounds.south, east: bounds.east },
  ];
}

function canSplitBounds(bounds: Bounds, depth: number): boolean {
  return (
    depth < UP_HELLAS_MAX_SPLIT_DEPTH &&
    bounds.north - bounds.south > UP_HELLAS_MIN_LAT_SPAN &&
    bounds.east - bounds.west > UP_HELLAS_MIN_LNG_SPAN
  );
}

function getFeatureKey(feature: PartnerFeature): string {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  return String(
    props.mongo_id ??
      props.ID ??
      props.MerchantId ??
      props.VATNumber ??
      `${lng}:${lat}:${props.BrandName_GR ?? props.BrandName_EN ?? props.BrandNameGR ?? props.BrandNameEN ?? ""}`,
  );
}

function addSourceFlag(feature: PartnerFeature): PartnerFeature {
  return {
    ...feature,
    properties: {
      ...feature.properties,
      __source: "up_hellas",
    },
  };
}

async function fetchUpHellasBounds(bounds: Bounds): Promise<PartnerFeature[]> {
  const res = await fetch(UP_HELLAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(boundsToPayload(bounds)),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Up Hellas returned ${res.status}`);
  }

  const data = (await res.json()) as { features?: PartnerFeature[] };
  return Array.isArray(data.features) ? data.features : [];
}

async function processUpHellasBounds(
  item: BoundsQueueItem,
  state: UpHellasFetchState,
): Promise<void> {
  const features = await fetchUpHellasBounds(item.bounds);

  for (const feature of features) {
    state.featuresByKey.set(getFeatureKey(feature), addSourceFlag(feature));
  }

  const shouldSplit =
    features.length >= UP_HELLAS_DENSE_RESULT_THRESHOLD &&
    canSplitBounds(item.bounds, item.depth);

  if (!shouldSplit) {
    if (features.length >= UP_HELLAS_DENSE_RESULT_THRESHOLD) {
      state.saturatedBounds.push(item);
    }
    return;
  }

  state.queue.push(
    ...splitBounds(item.bounds).map((bounds) => ({
      bounds,
      depth: item.depth + 1,
    })),
  );
}

/**
 * One upstream POST per bbox for map viewports (mobile-app style).
 * Use `fetchAllUpHellasFeatures` only for full-catalogue builds.
 */
export async function fetchUpHellasViewport(bounds: Bounds): Promise<UpHellasFetchResult> {
  try {
    const raw = await fetchUpHellasBounds(bounds);
    const features = raw.map((feature) => addSourceFlag(feature));
    const saturated = features.length >= UP_HELLAS_DENSE_RESULT_THRESHOLD;
    return {
      features,
      requestCount: 1,
      saturatedBoundsCount: saturated ? 1 : 0,
      stoppedByRequestLimit: false,
      complete: !saturated,
    };
  } catch (err) {
    console.error("fetchUpHellasViewport failed:", bounds, err);
    return {
      features: [],
      requestCount: 1,
      saturatedBoundsCount: 0,
      stoppedByRequestLimit: false,
      complete: false,
    };
  }
}

/** Full-catalogue / nationwide search only — never use for map viewport POSTs. */
export async function fetchAllUpHellasFeatures(
  bounds: Bounds,
): Promise<UpHellasFetchResult> {
  const state: UpHellasFetchState = {
    queue: [{ bounds, depth: 0 }],
    featuresByKey: new Map(),
    requestCount: 0,
    saturatedBounds: [],
    stoppedByRequestLimit: false,
  };

  let active = 0;

  await new Promise<void>((resolve) => {
    const pump = () => {
      while (
        active < UP_HELLAS_REQUEST_CONCURRENCY &&
        state.queue.length > 0 &&
        state.requestCount < UP_HELLAS_MAX_REQUESTS_PER_CALL
      ) {
        const item = state.queue.shift();
        if (!item) continue;
        active += 1;
        state.requestCount += 1;
        processUpHellasBounds(item, state)
          .catch((err) => {
            console.error("Failed to fetch Up Hellas bounds:", item.bounds, err);
            state.saturatedBounds.push(item);
          })
          .finally(() => {
            active -= 1;
            if (
              state.requestCount >= UP_HELLAS_MAX_REQUESTS_PER_CALL &&
              state.queue.length > 0
            ) {
              state.stoppedByRequestLimit = true;
              state.queue = [];
            }

            if (state.queue.length === 0 && active === 0) {
              resolve();
            } else {
              pump();
            }
          });
      }
    };

    pump();
  });

  if (state.saturatedBounds.length > 0 || state.stoppedByRequestLimit) {
    console.warn("Up Hellas fetch may be incomplete", {
      requestCount: state.requestCount,
      saturatedBoundsCount: state.saturatedBounds.length,
      stoppedByRequestLimit: state.stoppedByRequestLimit,
    });
  }

  const saturatedBoundsCount = state.saturatedBounds.length;
  return {
    features: Array.from(state.featuresByKey.values()),
    requestCount: state.requestCount,
    saturatedBoundsCount,
    stoppedByRequestLimit: state.stoppedByRequestLimit,
    complete: saturatedBoundsCount === 0 && !state.stoppedByRequestLimit,
  };
}
