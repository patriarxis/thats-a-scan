"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { type MerchantFeature } from "@/types";
import { MAP_MAX_LAT_SPAN, MAP_MAX_LNG_SPAN } from "@/lib/config";
import { INITIAL_CATALOGUE_BBOX } from "@/lib/merchantInitialCatalogueBbox";
import {
  getBufferedBoundsBox,
  MAP_MOVE_THROTTLE_MS,
  moveDebounceMsForZoom,
  pointInBoundsBox,
  shouldUpdateViewportOnMove,
  throttle,
} from "@/lib/mapViewport";

const MERCHANTS_API_PATH = "/api/merchants-geojson";
const BACKGROUND_REFRESH_MS = 30 * 60 * 1000;
const FETCH_RETRY_DELAYS_MS = [0, 500, 1500];
const WIDE_PREVIEW_MAX_FEATURES = 400;
const WIDE_PREVIEW_GRID_DECIMALS = 1;

/** Wait until style is ready and the map camera is idle before running heavy work (avoids jank during flyTo). */
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

export type UserLocation = {
  lat: number;
  lng: number;
};

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
  source:
    | "initial-bbox"
    | "initial-full"
    | "initial-full-fallback"
    | "background-refresh"
    | "retry",
  payload: {
    featureCount: number;
    complete: boolean | undefined;
    meta: MerchantApiResponse["meta"];
    attempt: number;
  },
) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[merchant-fetch]", {
    source,
    attempt: payload.attempt,
    featureCount: payload.featureCount,
    upHellas: {
      requestCount: payload.meta?.upHellas?.requestCount,
      saturatedBoundsCount: payload.meta?.upHellas?.saturatedBoundsCount,
      stoppedByRequestLimit: payload.meta?.upHellas?.stoppedByRequestLimit,
      complete: payload.meta?.upHellas?.complete,
    },
    serverLoadedAt: payload.meta?.loadedAt,
  });
}

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  }, []);

  return userLocation;
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
  const initialLoadedRef = useRef(false);
  const backgroundFetchControllerRef = useRef<AbortController | null>(null);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAppliedLocationFlyRef = useRef(false);

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
        feature.properties.VATName_EN ??
        feature.properties.VATNameEN ??
        feature.properties.VATName_GR ??
        feature.properties.VATNameGR ??
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

  const downsampleForWidePreview = (
    features: MerchantFeature[],
  ): MerchantFeature[] => {
    if (features.length <= WIDE_PREVIEW_MAX_FEATURES) return features;
    const byGrid = new Map<string, MerchantFeature>();
    for (const feature of features) {
      const lng = Number(feature.geometry.coordinates[0]);
      const lat = Number(feature.geometry.coordinates[1]);
      const key = `${lat.toFixed(WIDE_PREVIEW_GRID_DECIMALS)}:${lng.toFixed(WIDE_PREVIEW_GRID_DECIMALS)}`;
      if (!byGrid.has(key)) byGrid.set(key, feature);
    }
    const compact = Array.from(byGrid.values());
    if (compact.length <= WIDE_PREVIEW_MAX_FEATURES) return compact;
    const step = Math.ceil(compact.length / WIDE_PREVIEW_MAX_FEATURES);
    return compact
      .filter((_, index) => index % step === 0)
      .slice(0, WIDE_PREVIEW_MAX_FEATURES);
  };

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let alive = true;
    const hydrationController = new AbortController();

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

    /** Full-catalogue responses: rebuild the store in one pass (avoids O(n) deep compares on refresh). */
    const replaceGlobalStore = (incoming: MerchantFeature[]) => {
      const next = new Map<string, MerchantFeature>();
      for (const feature of incoming) {
        const lng = Number(feature.geometry.coordinates[0]);
        const lat = Number(feature.geometry.coordinates[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        next.set(getCanonicalFeatureKey(feature), feature);
      }
      globalStoreRef.current = next;
    };

    const computeVisible = () => {
      const bounds = map.getBounds();
      if (!bounds) {
        return { merchants: [] as MerchantFeature[], viewportTooWide: false };
      }
      const north = bounds.getNorth();
      const south = bounds.getSouth();
      const east = bounds.getEast();
      const west = bounds.getWest();
      const latSpan = Math.abs(north - south);
      const lngSpan = Math.abs(east - west);
      const viewportTooWide =
        latSpan > MAP_MAX_LAT_SPAN || lngSpan > MAP_MAX_LNG_SPAN;

      const queryBounds = getBufferedBoundsBox(map);
      const inView: MerchantFeature[] = [];
      for (const feature of globalStoreRef.current.values()) {
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        if (queryBounds && pointInBoundsBox(lng, lat, queryBounds)) {
          inView.push(feature);
        }
      }
      const sorted = sortFeaturesByUserDistance(inView);
      const merchants = viewportTooWide
        ? downsampleForWidePreview(sorted)
        : sorted;
      return { merchants, viewportTooWide };
    };

    const applyVisibleToState = () => {
      if (!alive) return;
      const { merchants, viewportTooWide } = computeVisible();
      setState({
        merchants,
        loading: false,
        updating: false,
        viewportTooWide,
        error: null,
      });
    };

    const fetchMerchantCollection = async (
      kind: "bbox" | "full",
      logSource:
        | "initial-bbox"
        | "initial-full"
        | "initial-full-fallback"
        | "background-refresh",
      signal: AbortSignal | undefined,
    ): Promise<MerchantApiResponse | null> => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = FETCH_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (signal?.aborted) return null;
        try {
          const res =
            kind === "bbox"
              ? await fetch(MERCHANTS_API_PATH, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(INITIAL_CATALOGUE_BBOX),
                  signal,
                })
              : await fetch(`${MERCHANTS_API_PATH}?scope=all`, { signal });

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
          });
          return json;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return null;
          }
          lastError = err;
          if (attempt < FETCH_RETRY_DELAYS_MS.length - 1) {
            logCatalogueFetch("retry", {
              featureCount: 0,
              complete: undefined,
              meta: undefined,
              attempt: attempt + 1,
            });
          }
        }
      }
      console.error("Failed to load merchant catalogue:", lastError);
      return null;
    };

    const triggerVisibleUpdate = () => {
      if (!initialLoadedRef.current) return;
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      const delay = moveDebounceMsForZoom(map.getZoom());
      if (delay === 0) {
        applyVisibleToState();
        return;
      }
      moveDebounceRef.current = setTimeout(() => {
        moveDebounceRef.current = null;
        applyVisibleToState();
      }, delay);
    };

    const throttledMoveVisibleUpdate = throttle(() => {
      if (!initialLoadedRef.current) return;
      if (!shouldUpdateViewportOnMove(map.getZoom())) return;
      applyVisibleToState();
    }, MAP_MOVE_THROTTLE_MS);

    const scheduleBackgroundRefresh = () => {
      if (backgroundRefreshTimerRef.current) {
        clearTimeout(backgroundRefreshTimerRef.current);
      }
      backgroundRefreshTimerRef.current = setTimeout(async () => {
        backgroundFetchControllerRef.current?.abort();
        const controller = new AbortController();
        backgroundFetchControllerRef.current = controller;
        const json = await fetchMerchantCollection(
          "full",
          "background-refresh",
          controller.signal,
        );
        if (json && Array.isArray(json.features) && !controller.signal.aborted && alive) {
          const features = json.features;
          scheduleWhenMapQuiet(map, () => alive, () => {
            if (!alive || controller.signal.aborted) return;
            replaceGlobalStore(features);
            applyVisibleToState();
          });
        }
        if (alive) scheduleBackgroundRefresh();
      }, BACKGROUND_REFRESH_MS);
    };

    map.on("moveend", triggerVisibleUpdate);
    map.on("move", throttledMoveVisibleUpdate);

    if (initialLoadedRef.current) {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 13,
          duration: 900,
        });
      }
      applyVisibleToState();
      scheduleBackgroundRefresh();
      return () => {
        alive = false;
        hydrationController.abort();
        map.off("moveend", triggerVisibleUpdate);
        map.off("move", throttledMoveVisibleUpdate);
        throttledMoveVisibleUpdate.cancel();
        if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
        if (backgroundRefreshTimerRef.current) {
          clearTimeout(backgroundRefreshTimerRef.current);
        }
        backgroundFetchControllerRef.current?.abort();
      };
    }

    const runInitialCatalogue = async () => {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 13,
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

      // Bbox first, parallel with Mapbox style; no AbortSignal so Strict Mode cleanup does not cancel it.
      let json = await fetchMerchantCollection("bbox", "initial-bbox", undefined);

      if (!alive) return;

      if (!json) {
        json = await fetchMerchantCollection("full", "initial-full-fallback", undefined);
      }

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

      mergeIntoStore(json.features);
      initialLoadedRef.current = true;
      applyVisibleToState();
      scheduleBackgroundRefresh();

      if (!alive) return;

      setState((prev) => ({
        ...prev,
        updating: true,
      }));

      const fullJson = await fetchMerchantCollection(
        "full",
        "initial-full",
        hydrationController.signal,
      );
      if (!alive || hydrationController.signal.aborted) {
        setState((prev) => ({ ...prev, updating: false }));
        return;
      }
      if (fullJson && Array.isArray(fullJson.features)) {
        const features = fullJson.features;
        scheduleWhenMapQuiet(map, () => alive, () => {
          if (!alive || hydrationController.signal.aborted) {
            setState((prev) => ({ ...prev, updating: false }));
            return;
          }
          replaceGlobalStore(features);
          applyVisibleToState();
        });
      } else {
        setState((prev) => ({ ...prev, updating: false }));
      }
    };

    void runInitialCatalogue();

    return () => {
      alive = false;
      hydrationController.abort();
      map.off("moveend", triggerVisibleUpdate);
      map.off("move", throttledMoveVisibleUpdate);
      throttledMoveVisibleUpdate.cancel();
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      if (backgroundRefreshTimerRef.current) {
        clearTimeout(backgroundRefreshTimerRef.current);
      }
      backgroundFetchControllerRef.current?.abort();
    };
  }, [mapReady, mapRef, userLocation]);

  return state;
}
