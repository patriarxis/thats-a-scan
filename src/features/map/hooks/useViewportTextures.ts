"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import { INITIAL_FOCUS_ZOOM, MAP_MAX_LAT_SPAN, MAP_MAX_LNG_SPAN, isWithinAthensCatalog } from "@/config/map";
import {
  getBufferedBoundsBox,
  MAP_MOVE_THROTTLE_MS,
  moveDebounceMsForZoom,
  pointInBoundsBox,
  throttle,
} from "@/lib/mapViewport";
import type { UserLocation } from "@/shared/hooks/useUserLocation";

const TEXTURES_API_PATH = "/api/textures";

type ViewportQueryState = {
  textures: TextureFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
  error: string | null;
};

type BoundsPayload = {
  north_west: { latitude: number; longitude: number };
  south_east: { latitude: number; longitude: number };
};

export function useViewportTextureQuery(
  mapRef: MutableRefObject<MapLibreMap | null>,
  userLocation: UserLocation | null,
  mapReady: boolean,
) {
  const [state, setState] = useState<ViewportQueryState>({
    textures: [],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null,
  });

  const globalStoreRef = useRef<Map<string, TextureFeature>>(new Map());
  const initialLoadedRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAppliedLocationFlyRef = useRef(false);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let alive = true;

    const boundsFromMap = (): BoundsPayload | null => {
      const bounds = map.getBounds();
      if (!bounds) return null;
      return {
        north_west: { latitude: bounds.getNorth(), longitude: bounds.getWest() },
        south_east: { latitude: bounds.getSouth(), longitude: bounds.getEast() },
      };
    };

    const computeVisible = () => {
      const bounds = map.getBounds();
      if (!bounds) {
        return { textures: [] as TextureFeature[], viewportTooWide: false };
      }
      const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
      const viewportTooWide =
        latSpan > MAP_MAX_LAT_SPAN || lngSpan > MAP_MAX_LNG_SPAN;

      const queryBounds = getBufferedBoundsBox(map);
      const textures: TextureFeature[] = [];
      for (const feature of globalStoreRef.current.values()) {
        const [lng, lat] = feature.geometry.coordinates;
        if (queryBounds && pointInBoundsBox(lng, lat, queryBounds)) {
          textures.push(feature);
        }
      }
      return { textures, viewportTooWide };
    };

    const applyVisible = (options?: { updating?: boolean }) => {
      if (!alive) return;
      const { textures, viewportTooWide } = computeVisible();
      setState((prev) => ({
        textures,
        loading: false,
        updating: options?.updating ?? false,
        viewportTooWide,
        error: null,
      }));
    };

    const mergeIntoStore = (incoming: TextureFeature[]) => {
      for (const feature of incoming) {
        globalStoreRef.current.set(getTextureId(feature), feature);
      }
    };

    const fetchBounds = async (bounds: BoundsPayload, signal?: AbortSignal) => {
      const res = await fetch(TEXTURES_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bounds),
        signal,
      });
      if (!res.ok) throw new Error(`Texture fetch failed: ${res.status}`);
      const json = (await res.json()) as { features?: TextureFeature[] };
      return Array.isArray(json.features) ? json.features : [];
    };

    const loadViewport = async () => {
      const bounds = boundsFromMap();
      if (!bounds) return;

      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      setState((prev) => ({ ...prev, updating: true }));

      try {
        const features = await fetchBounds(bounds, controller.signal);
        if (!alive) return;
        mergeIntoStore(features);
        applyVisible({ updating: false });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          updating: false,
          error: "Failed to load textures. Please try again.",
        }));
      }
    };

    const triggerUpdate = () => {
      if (!initialLoadedRef.current) return;
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
      const delay = moveDebounceMsForZoom(map.getZoom());
      const run = () => {
        applyVisible();
        void loadViewport();
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

    const throttledApply = throttle(() => {
      if (!initialLoadedRef.current) return;
      applyVisible();
    }, MAP_MOVE_THROTTLE_MS);

    map.on("moveend", triggerUpdate);
    map.on("zoomend", triggerUpdate);
    map.on("move", throttledApply);

    const runInitial = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const bounds = boundsFromMap();
        if (!bounds) throw new Error("No bounds");
        const features = await fetchBounds(bounds);
        if (!alive) return;
        mergeIntoStore(features);
        initialLoadedRef.current = true;
        applyVisible();
      } catch {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load textures. Please try again.",
        }));
      }
    };

    if (initialLoadedRef.current) {
      applyVisible();
      void loadViewport();
    } else {
      void runInitial();
    }

    return () => {
      alive = false;
      inFlightRef.current?.abort();
      map.off("moveend", triggerUpdate);
      map.off("zoomend", triggerUpdate);
      map.off("move", throttledApply);
      throttledApply.cancel();
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
    };
  }, [mapReady, mapRef]);

  useEffect(() => {
    if (!mapReady || !userLocation) return;
    const map = mapRef.current;
    if (!map || hasAppliedLocationFlyRef.current) return;
    if (!isWithinAthensCatalog(userLocation.lat, userLocation.lng)) return;
    hasAppliedLocationFlyRef.current = true;
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: INITIAL_FOCUS_ZOOM,
      duration: 900,
    });
  }, [mapReady, mapRef, userLocation]);

  return state;
}
