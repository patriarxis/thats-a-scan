"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { type MerchantFeature } from "@/types";
import { MAP_MAX_LAT_SPAN, MAP_MAX_LNG_SPAN } from "@/lib/config";

const CATALOGUE_URL = "/api/merchants-geojson?scope=all";
const MOVE_DEBOUNCE_MS = 200;
const BACKGROUND_REFRESH_MS = 30 * 60 * 1000;
const FETCH_RETRY_DELAYS_MS = [0, 500, 1500];
const WIDE_PREVIEW_MAX_FEATURES = 220;
const WIDE_PREVIEW_GRID_DECIMALS = 1;

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
  source: "initial" | "background-refresh" | "retry",
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
  const initialFetchControllerRef = useRef<AbortController | null>(null);
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

      const inView: MerchantFeature[] = [];
      for (const feature of globalStoreRef.current.values()) {
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        if (lat <= north && lat >= south && lng >= west && lng <= east) {
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
      const { merchants, viewportTooWide } = computeVisible();
      setState({
        merchants,
        loading: false,
        updating: false,
        viewportTooWide,
        error: null,
      });
    };

    const fetchCatalogue = async (
      source: "initial" | "background-refresh",
      signal: AbortSignal,
    ): Promise<boolean> => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = FETCH_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (signal.aborted) return false;
        try {
          const res = await fetch(CATALOGUE_URL, { signal });
          if (!res.ok) {
            throw new Error(`Merchant catalogue request failed: ${res.status}`);
          }
          const json = (await res.json()) as MerchantApiResponse;
          const features = Array.isArray(json.features) ? json.features : [];
          mergeIntoStore(features);
          logCatalogueFetch(source, {
            featureCount: features.length,
            complete: json.meta?.upHellas?.complete,
            meta: json.meta,
            attempt: attempt + 1,
          });
          return true;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return false;
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
      return false;
    };

    const triggerVisibleUpdate = () => {
      if (!initialLoadedRef.current) return;
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      moveDebounceRef.current = setTimeout(() => {
        applyVisibleToState();
      }, MOVE_DEBOUNCE_MS);
    };

    const scheduleBackgroundRefresh = () => {
      if (backgroundRefreshTimerRef.current) {
        clearTimeout(backgroundRefreshTimerRef.current);
      }
      backgroundRefreshTimerRef.current = setTimeout(async () => {
        backgroundFetchControllerRef.current?.abort();
        const controller = new AbortController();
        backgroundFetchControllerRef.current = controller;
        const ok = await fetchCatalogue("background-refresh", controller.signal);
        if (ok && !controller.signal.aborted) {
          applyVisibleToState();
        }
        scheduleBackgroundRefresh();
      }, BACKGROUND_REFRESH_MS);
    };

    const initialise = async () => {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 13,
          duration: 900,
        });
      }

      const controller = new AbortController();
      initialFetchControllerRef.current = controller;
      setState((prev) => ({
        ...prev,
        loading: true,
        updating: false,
        viewportTooWide: false,
        error: null,
      }));

      const ok = await fetchCatalogue("initial", controller.signal);
      if (controller.signal.aborted) return;
      if (!ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          updating: false,
          error: "Failed to load stores. Please try again.",
        }));
        return;
      }
      initialLoadedRef.current = true;
      applyVisibleToState();
      scheduleBackgroundRefresh();
    };

    map.on("moveend", triggerVisibleUpdate);
    if (map.isStyleLoaded()) initialise();
    else map.once("load", initialise);

    return () => {
      map.off("moveend", triggerVisibleUpdate);
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      if (backgroundRefreshTimerRef.current) {
        clearTimeout(backgroundRefreshTimerRef.current);
      }
      initialFetchControllerRef.current?.abort();
      backgroundFetchControllerRef.current?.abort();
    };
  }, [mapReady, mapRef, userLocation]);

  return state;
}
