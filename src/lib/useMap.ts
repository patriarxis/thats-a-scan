"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { UserLocation } from "@/lib/UserLocationContext";
import { type MerchantFeature } from "@/types";
import {
  INITIAL_FOCUS_ZOOM,
  MAP_MAX_LAT_SPAN,
  MAP_MAX_LNG_SPAN,
  MAX_CONCURRENT_FETCHES,
  MAX_MERCHANTS_FOR_MAP_RENDER,
  MAX_VIEWPORT_FETCH_CONTINUE_ROUNDS,
  OVERVIEW_FETCH_DELAY_MS,
  PREFETCH_MOVE_THROTTLE_MS,
} from "@/lib/config";
import {
  backfillFetchedTilesFromStore,
  bboxesIntersect,
  downsampleForViewportHotspots,
  GREECE_OVERVIEW_BBOX,
  overviewDisplayWeight,
  initialCatalogueBboxForLocation,
  isMapSpanTooWide,
  isViewportSatisfied,
  markTilesFetched,
  markTilesFetchedForBbox,
  planFocusDetailFetch,
  planLeadingEdgeFetches,
  planViewportFetches,
  sortPlannedBboxesByPriority,
  viewportFetchMode,
  type PlannedBbox,
} from "@/lib/merchantViewportTiles";
import {
  getBufferedBoundsBox,
  MAP_MOVE_THROTTLE_MS,
  mapCenter,
  moveDebounceMsForZoom,
  movementBetweenCenters,
  pointInBoundsBox,
  throttle,
} from "@/lib/mapViewport";
import type { BBoxPayload } from "@/lib/upHellasMerchants";

const MERCHANTS_API_PATH = "/api/merchants-geojson";
const FETCH_RETRY_DELAYS_MS = [0, 500, 1500];
const MAP_QUIET_MAX_WAIT_MS = 5000;

function scheduleWhenMapQuiet(
  map: MapboxMap,
  isAlive: () => boolean,
  fn: () => void,
): void {
  const deadline = Date.now() + MAP_QUIET_MAX_WAIT_MS;

  const step = () => {
    if (!isAlive()) return;
    if (!map.isStyleLoaded()) {
      map.once("load", step);
      return;
    }
    if (map.isMoving() && Date.now() < deadline) {
      map.once("idle", step);
      return;
    }
    if (!isAlive()) return;
    fn();
  };

  queueMicrotask(step);
}

export type { UserLocation, UserLocationPermission } from "@/lib/UserLocationContext";
export { UserLocationProvider, useUserLocation } from "@/lib/UserLocationContext";

type ViewportQueryState = {
  merchants: MerchantFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
  error: string | null;
};

type MerchantApiResponse = {
  features?: MerchantFeature[];
  meta?: {
    cache?: { hit?: string };
    upHellas?: {
      requestCount?: number;
      saturatedBoundsCount?: number;
      stoppedByRequestLimit?: boolean;
      complete?: boolean;
    };
    loadedAt?: number;
  };
};

function haversineDistanceKm(
  pointA: [number, number],
  pointB: [number, number],
): number {
  const [lng1, lat1] = pointA;
  const [lng2, lat2] = pointB;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function logCatalogueFetch(
  source: string,
  payload: {
    featureCount: number;
    complete: boolean | undefined;
    meta: MerchantApiResponse["meta"];
    attempt: number;
    durationMs?: number;
    generation?: number;
  },
) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[merchant-fetch]", {
    source,
    attempt: payload.attempt,
    generation: payload.generation,
    featureCount: payload.featureCount,
    durationMs: payload.durationMs,
    cacheHit: payload.meta?.cache?.hit,
    upHellas: {
      requestCount: payload.meta?.upHellas?.requestCount,
      complete: payload.meta?.upHellas?.complete,
    },
  });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!);
    }
  });

  await Promise.all(runners);
  return results;
}

export function useViewportStoreQuery(
  mapRef: MutableRefObject<MapboxMap | null>,
  userLocation: UserLocation | null,
  mapReady: boolean,
) {
  const [state, setState] = useState<ViewportQueryState>({
    merchants: [],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null,
  });

  const globalStoreRef = useRef<Map<string, MerchantFeature>>(new Map());
  const overviewStoreRef = useRef<Map<string, MerchantFeature>>(new Map());
  const overviewLoadedRef = useRef(false);
  const overviewLoadingRef = useRef(false);
  const initialLoadedRef = useRef(false);
  const fetchedTilesRef = useRef<Set<string>>(new Set());
  const inFlightControllersRef = useRef<Map<string, AbortController>>(new Map());
  const fetchGenerationRef = useRef(0);
  const viewportContinueRoundsRef = useRef(0);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAppliedLocationFlyRef = useRef(false);
  const prevMapCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  const getCanonicalFeatureKey = (feature: MerchantFeature): string => {
    const rawId = String(
      feature.properties.ID ??
        feature.properties.MerchantId ??
        feature.properties.mongo_id ??
        "",
    )
      .trim()
      .toLowerCase();
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    const coordKey =
      Number.isFinite(lng) && Number.isFinite(lat)
        ? `${lng.toFixed(5)}:${lat.toFixed(5)}`
        : "";
    if (rawId) return `${rawId}|${coordKey}`;
    const name = String(
      feature.properties.BrandName_EN ??
        feature.properties.BrandNameEN ??
        feature.properties.BrandName_GR ??
        feature.properties.BrandNameGR ??
        "",
    )
      .trim()
      .toLowerCase();
    if (name) return `${name}|${coordKey}`;
    return coordKey;
  };

  const sortFeaturesByUserDistance = (features: MerchantFeature[]) => {
    if (!userLocation || features.length > 1000) return features;
    return [...features].sort((a, b) => {
      const dA = haversineDistanceKm(a.geometry.coordinates, [
        userLocation.lng,
        userLocation.lat,
      ]);
      const dB = haversineDistanceKm(b.geometry.coordinates, [
        userLocation.lng,
        userLocation.lat,
      ]);
      return dA - dB;
    });
  };

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let alive = true;

    const mergeIntoStore = (incoming: MerchantFeature[]): boolean => {
      let changed = false;
      for (const feature of incoming) {
        const lng = Number(feature.geometry.coordinates[0]);
        const lat = Number(feature.geometry.coordinates[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const id = getCanonicalFeatureKey(feature);
        const prev = globalStoreRef.current.get(id);
        if (!prev) {
          globalStoreRef.current.set(id, feature);
          changed = true;
          continue;
        }
        const sameCoords =
          prev.geometry.coordinates[0] === feature.geometry.coordinates[0] &&
          prev.geometry.coordinates[1] === feature.geometry.coordinates[1];
        if (
          !sameCoords ||
          JSON.stringify(prev.properties) !== JSON.stringify(feature.properties)
        ) {
          globalStoreRef.current.set(id, feature);
          changed = true;
        }
      }
      return changed;
    };

    const mergeOverviewIntoStore = (incoming: MerchantFeature[]): boolean => {
      let changed = false;
      for (const feature of incoming) {
        const lng = Number(feature.geometry.coordinates[0]);
        const lat = Number(feature.geometry.coordinates[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const id = getCanonicalFeatureKey(feature);
        if (!overviewStoreRef.current.has(id)) {
          overviewStoreRef.current.set(id, feature);
          changed = true;
        }
      }
      return changed;
    };

    const loadGreeceOverview = async () => {
      if (overviewLoadedRef.current || overviewLoadingRef.current || !alive) return;
      overviewLoadingRef.current = true;
      const json = await fetchBbox(GREECE_OVERVIEW_BBOX, "overview", undefined, -1);
      overviewLoadingRef.current = false;
      if (!alive) return;
      if (json && Array.isArray(json.features) && json.features.length > 0) {
        mergeOverviewIntoStore(json.features);
        overviewLoadedRef.current = true;
        applyVisibleToState({ updating: false });
      }
    };

    const scheduleGreeceOverviewLoad = () => {
      if (overviewLoadedRef.current || overviewLoadingRef.current) return;
      window.setTimeout(() => {
        if (alive) void loadGreeceOverview();
      }, OVERVIEW_FETCH_DELAY_MS);
    };

    const computeVisible = () => {
      const bounds = map.getBounds();
      if (!bounds) {
        return { merchants: [] as MerchantFeature[], viewportTooWide: false };
      }
      const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
      const viewportTooWide =
        latSpan > MAP_MAX_LAT_SPAN || lngSpan > MAP_MAX_LNG_SPAN;
      const zoom = map.getZoom();
      const overviewWeight = overviewDisplayWeight(zoom, viewportTooWide);

      const queryBounds = getBufferedBoundsBox(map);
      const inViewByKey = new Map<string, MerchantFeature>();

      for (const feature of globalStoreRef.current.values()) {
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        if (queryBounds && pointInBoundsBox(lng, lat, queryBounds)) {
          inViewByKey.set(getCanonicalFeatureKey(feature), feature);
        }
      }

      if (overviewWeight > 0) {
        for (const feature of overviewStoreRef.current.values()) {
          const key = getCanonicalFeatureKey(feature);
          if (inViewByKey.has(key)) continue;
          const lng = feature.geometry.coordinates[0];
          const lat = feature.geometry.coordinates[1];
          if (queryBounds && pointInBoundsBox(lng, lat, queryBounds)) {
            inViewByKey.set(key, feature);
          }
        }
      }

      let merchants = Array.from(inViewByKey.values());
      if (overviewWeight > 0 && queryBounds) {
        merchants = downsampleForViewportHotspots(
          merchants,
          queryBounds,
          zoom,
          viewportTooWide,
        );
      } else if (merchants.length > MAX_MERCHANTS_FOR_MAP_RENDER && queryBounds) {
        merchants = downsampleForViewportHotspots(
          merchants,
          queryBounds,
          zoom,
          false,
        ).slice(0, MAX_MERCHANTS_FOR_MAP_RENDER);
      }
      merchants = sortFeaturesByUserDistance(merchants);
      return { merchants, viewportTooWide };
    };

    const applyVisibleToState = (options?: { updating?: boolean }) => {
      if (!alive) return;
      const { merchants, viewportTooWide } = computeVisible();
      setState((prev) => ({
        merchants,
        loading: false,
        updating: options?.updating ?? prev.updating,
        viewportTooWide,
        error: null,
      }));
    };

    const fetchBbox = async (
      bbox: BBoxPayload,
      logSource: string,
      signal: AbortSignal | undefined,
      generation: number,
    ): Promise<MerchantApiResponse | null> => {
      const started = Date.now();
      let lastError: unknown = null;
      for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = FETCH_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (signal?.aborted) return null;
        try {
          const res = await fetch(MERCHANTS_API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bbox),
            signal,
          });

          if (!res.ok) {
            throw new Error(`Merchant catalogue request failed: ${res.status}`);
          }
          const json = (await res.json()) as MerchantApiResponse;
          const features = Array.isArray(json.features) ? json.features : [];
          logCatalogueFetch(logSource, {
            featureCount: features.length,
            complete: json.meta?.upHellas?.complete,
            meta: json.meta,
            attempt: attempt + 1,
            durationMs: Date.now() - started,
            generation,
          });
          return json;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return null;
          }
          lastError = err;
        }
      }
      console.error("Failed to load merchant catalogue:", lastError);
      return null;
    };

    const abortStaleOutOfView = (
      queryBounds: NonNullable<ReturnType<typeof getBufferedBoundsBox>>,
    ) => {
      for (const [requestId, controller] of inFlightControllersRef.current.entries()) {
        const [, bboxJson] = requestId.split("|");
        if (!bboxJson) continue;
        try {
          const bbox = JSON.parse(bboxJson) as BBoxPayload;
          if (!bboxesIntersect(bbox, queryBounds)) {
            controller.abort();
            inFlightControllersRef.current.delete(requestId);
          }
        } catch {
          controller.abort();
          inFlightControllersRef.current.delete(requestId);
        }
      }
    };

    const requestIdFor = (generation: number, bbox: BBoxPayload): string =>
      `${generation}|${JSON.stringify(bbox)}`;

    const runPlannedFetches = async (
      planned: PlannedBbox[],
      generation: number,
      options: { priorityOnly: boolean },
    ) => {
      if (planned.length === 0) return;

      const queryBounds = getBufferedBoundsBox(map);
      if (!queryBounds) return;

      const center = mapCenter(map) ?? {
        lat: (queryBounds.north + queryBounds.south) / 2,
        lng: (queryBounds.east + queryBounds.west) / 2,
      };

      const sorted = sortPlannedBboxesByPriority(planned, center);
      const minPriority = Math.min(...sorted.map((p) => p.priority));
      const priorityBatch = sorted.filter((p) => p.priority === minPriority);
      const backgroundBatch = sorted.filter((p) => p.priority > minPriority);

      const batches = options.priorityOnly
        ? [priorityBatch]
        : [priorityBatch, backgroundBatch].filter((b) => b.length > 0);

      let storeChanged = false;

      for (const batch of batches) {
        if (!alive || generation !== fetchGenerationRef.current) break;

        const isBackground = batch === backgroundBatch && backgroundBatch.length > 0;
        if (!isBackground) {
          setState((prev) => ({ ...prev, updating: true }));
        }

        await runWithConcurrency(batch, MAX_CONCURRENT_FETCHES, async (item) => {
          if (!alive || generation !== fetchGenerationRef.current) return;

          const requestId = requestIdFor(generation, item.bbox);
          if (inFlightControllersRef.current.has(requestId)) return;

          const controller = new AbortController();
          inFlightControllersRef.current.set(requestId, controller);

          try {
            const json = await fetchBbox(
              item.bbox,
              isBackground ? "prefetch" : "viewport",
              controller.signal,
              generation,
            );

            if (!alive || generation !== fetchGenerationRef.current) return;

            markTilesFetched(item.tileKeys, fetchedTilesRef.current);

            if (json && Array.isArray(json.features) && json.features.length > 0) {
              if (mergeIntoStore(json.features)) {
                storeChanged = true;
              }
            }
          } finally {
            inFlightControllersRef.current.delete(requestId);
          }
        });

        if (!isBackground && alive && generation === fetchGenerationRef.current) {
          if (storeChanged) {
            applyVisibleToState({ updating: false });
            storeChanged = false;
          } else {
            setState((prev) => ({ ...prev, updating: false }));
          }

          const zoom = map.getZoom();
          const boundsAfter = getBufferedBoundsBox(map);
          if (
            boundsAfter &&
            batch.length > 0 &&
            viewportContinueRoundsRef.current < MAX_VIEWPORT_FETCH_CONTINUE_ROUNDS &&
            !isViewportSatisfied(boundsAfter, fetchedTilesRef.current, {
              zoom,
              neighborPadding: 1,
            })
          ) {
            viewportContinueRoundsRef.current += 1;
            window.setTimeout(() => {
              if (!alive || generation !== fetchGenerationRef.current) return;
              ensureViewportLoaded({ continueGeneration: true });
            }, 0);
          } else {
            viewportContinueRoundsRef.current = 0;
          }
        }
      }
    };

    const ensureViewportLoaded = (options?: {
      prefetchOnly?: boolean;
      movement?: { dLat: number; dLng: number } | null;
      /** Keep the current generation so follow-up cluster fetches are not aborted. */
      continueGeneration?: boolean;
    }) => {
      if (!initialLoadedRef.current) return;
      const queryBounds = getBufferedBoundsBox(map);
      if (!queryBounds) return;

      const zoom = map.getZoom();
      const mode = viewportFetchMode(zoom, queryBounds);
      const overviewWeight = overviewDisplayWeight(zoom, isMapSpanTooWide(queryBounds));

      if (overviewWeight > 0 && !overviewLoadedRef.current) {
        void loadGreeceOverview();
      }

      if (mode === "none") {
        void loadGreeceOverview();
        const focusPlanned = planFocusDetailFetch(queryBounds, zoom, fetchedTilesRef.current);
        if (focusPlanned.length > 0) {
          void runPlannedFetches(focusPlanned, fetchGenerationRef.current, {
            priorityOnly: false,
          });
        }
        applyVisibleToState();
        return;
      }

      if (options?.prefetchOnly && mode !== "tiles") {
        return;
      }

      if (mode === "tiles" && globalStoreRef.current.size < 8000) {
        backfillFetchedTilesFromStore(
          queryBounds,
          globalStoreRef.current.values(),
          fetchedTilesRef.current,
        );
      }

      if (
        isViewportSatisfied(queryBounds, fetchedTilesRef.current, {
          zoom,
          neighborPadding: 1,
        })
      ) {
        applyVisibleToState();
        return;
      }

      abortStaleOutOfView(queryBounds);

      const generation =
        options?.prefetchOnly || options?.continueGeneration
          ? fetchGenerationRef.current
          : ++fetchGenerationRef.current;

      if (!options?.continueGeneration) {
        viewportContinueRoundsRef.current = 0;
      }

      let planned: PlannedBbox[] = [];

      if (overviewWeight > 0) {
        planned.push(
          ...planFocusDetailFetch(queryBounds, zoom, fetchedTilesRef.current),
        );
      }

      if (options?.movement) {
        planned.push(
          ...planLeadingEdgeFetches(
            queryBounds,
            zoom,
            options.movement,
            fetchedTilesRef.current,
          ),
        );
      }

      if (!options?.prefetchOnly) {
        planned.push(
          ...planViewportFetches(queryBounds, zoom, fetchedTilesRef.current, {
            neighborPadding: 1,
            priority: 0,
          }),
        );
      }

      const seen = new Set<string>();
      planned = planned.filter((p) => {
        const key = JSON.stringify(p.bbox);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (planned.length === 0) {
        applyVisibleToState();
        return;
      }

      void runPlannedFetches(planned, generation, {
        priorityOnly: Boolean(options?.prefetchOnly),
      });
    };

    const triggerVisibleUpdate = () => {
      if (!initialLoadedRef.current) return;
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      const delay = moveDebounceMsForZoom(map.getZoom());
      const run = () => {
        const center = mapCenter(map);
        const movement = movementBetweenCenters(
          prevMapCenterRef.current,
          center ?? { lat: 0, lng: 0 },
        );
        if (center) prevMapCenterRef.current = center;
        applyVisibleToState();
        ensureViewportLoaded({ movement });
      };
      if (delay === 0) {
        run();
        return;
      }
      moveDebounceRef.current = setTimeout(() => {
        moveDebounceRef.current = null;
        run();
      }, delay);
    };

    const throttledMoveVisibleUpdate = throttle(() => {
      if (!initialLoadedRef.current) return;
      const queryBounds = getBufferedBoundsBox(map);
      if (
        queryBounds &&
        viewportFetchMode(map.getZoom(), queryBounds) === "none"
      ) {
        return;
      }
      applyVisibleToState();
    }, MAP_MOVE_THROTTLE_MS);

    const throttledPrefetch = throttle(() => {
      if (!initialLoadedRef.current) return;
      const queryBounds = getBufferedBoundsBox(map);
      if (
        !queryBounds ||
        viewportFetchMode(map.getZoom(), queryBounds) !== "tiles"
      ) {
        return;
      }
      const center = mapCenter(map);
      if (!center) return;
      const movement = movementBetweenCenters(prevMapCenterRef.current, center);
      if (!movement) return;
      ensureViewportLoaded({ prefetchOnly: true, movement });
    }, PREFETCH_MOVE_THROTTLE_MS);

    map.on("moveend", triggerVisibleUpdate);
    map.on("zoomend", triggerVisibleUpdate);
    map.on("move", throttledMoveVisibleUpdate);
    map.on("move", throttledPrefetch);

    if (initialLoadedRef.current) {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: INITIAL_FOCUS_ZOOM,
          duration: 900,
        });
      }
      applyVisibleToState();
      ensureViewportLoaded();
      return () => {
        alive = false;
        for (const controller of inFlightControllersRef.current.values()) {
          controller.abort();
        }
        inFlightControllersRef.current.clear();
        map.off("moveend", triggerVisibleUpdate);
        map.off("zoomend", triggerVisibleUpdate);
        map.off("move", throttledMoveVisibleUpdate);
        map.off("move", throttledPrefetch);
        throttledMoveVisibleUpdate.cancel();
        throttledPrefetch.cancel();
        if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      };
    }

    const runInitialCatalogue = async () => {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: INITIAL_FOCUS_ZOOM,
          duration: 900,
        });
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        updating: false,
        viewportTooWide: false,
        error: null,
      }));

      const initialBbox = initialCatalogueBboxForLocation(
        userLocation,
        INITIAL_FOCUS_ZOOM,
      );
      const json = await fetchBbox(initialBbox, "initial", undefined, 0);

      if (!alive) return;

      if (!json || !Array.isArray(json.features)) {
        setState((prev) => ({
          ...prev,
          loading: false,
          updating: false,
          error: "Failed to load stores. Please try again.",
        }));
        return;
      }

      markTilesFetchedForBbox(initialBbox, fetchedTilesRef.current);
      mergeIntoStore(json.features);
      initialLoadedRef.current = true;
      const center = mapCenter(map);
      if (center) prevMapCenterRef.current = center;
      applyVisibleToState();

      scheduleGreeceOverviewLoad();

      scheduleWhenMapQuiet(map, () => alive, () => {
        ensureViewportLoaded();
      });
    };

    void runInitialCatalogue();

    return () => {
      alive = false;
      for (const controller of inFlightControllersRef.current.values()) {
        controller.abort();
      }
      inFlightControllersRef.current.clear();
      map.off("moveend", triggerVisibleUpdate);
      map.off("zoomend", triggerVisibleUpdate);
      map.off("move", throttledMoveVisibleUpdate);
      map.off("move", throttledPrefetch);
      throttledMoveVisibleUpdate.cancel();
      throttledPrefetch.cancel();
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
    };
  }, [mapReady, mapRef, userLocation]);

  return state;
}
