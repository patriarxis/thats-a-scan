"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import {
  ATLAS_TEXTURES_API_PATH,
  INITIAL_FOCUS_ZOOM,
  MAP_MAX_LAT_SPAN,
  MAP_MAX_LNG_SPAN,
  isWithinAthensCatalog,
} from "@/config/map";
import {
  getBufferedBoundsBox,
  MAP_MOVE_THROTTLE_MS,
  moveDebounceMsForZoom,
  pointInBoundsBox,
  throttle,
} from "@/lib/mapViewport";
import type { UserLocation } from "@/shared/hooks/useUserLocation";
import {
  EMPTY_TEXTURE_FILTERS,
  textureMatchesFilters,
  textureMatchesSearchQuery,
  type TextureFilterState,
} from "@/domain/textures/filters";

type ViewportQueryState = {
  textures: TextureFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
  error: string | null;
  /** Viewport matches before search and filters — drives the "no results" copy. */
  unfilteredCount: number;
};

export type ViewportQueryOptions = {
  filters?: TextureFilterState;
  searchQuery?: string;
};

type BoundsPayload = {
  north_west: { latitude: number; longitude: number };
  south_east: { latitude: number; longitude: number };
};

export function useViewportTextureQuery(
  mapRef: MutableRefObject<MapLibreMap | null>,
  userLocation: UserLocation | null,
  mapReady: boolean,
  options: ViewportQueryOptions = {},
) {
  const [state, setState] = useState<ViewportQueryState>({
    textures: [],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null,
    unfilteredCount: 0,
  });

  const globalStoreRef = useRef<Map<string, TextureFeature>>(new Map());
  const initialLoadedRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAppliedLocationFlyRef = useRef(false);

  // Filtering runs against the already-fetched store, so typing never costs a
  // round trip. A ref keeps the main effect from re-subscribing per keystroke.
  const filters = options.filters ?? EMPTY_TEXTURE_FILTERS;
  const searchQuery = options.searchQuery ?? "";
  const queryRef = useRef({ filters, searchQuery });
  const recomputeRef = useRef<(() => void) | null>(null);

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
        return {
          textures: [] as TextureFeature[],
          viewportTooWide: false,
          unfilteredCount: 0,
        };
      }
      const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
      const viewportTooWide =
        latSpan > MAP_MAX_LAT_SPAN || lngSpan > MAP_MAX_LNG_SPAN;

      const queryBounds = getBufferedBoundsBox(map);
      const { filters: activeFilters, searchQuery: activeQuery } = queryRef.current;
      const textures: TextureFeature[] = [];
      let unfilteredCount = 0;

      for (const feature of globalStoreRef.current.values()) {
        const [lng, lat] = feature.geometry.coordinates;
        if (!queryBounds || !pointInBoundsBox(lng, lat, queryBounds)) continue;
        unfilteredCount += 1;
        if (!textureMatchesFilters(feature, activeFilters)) continue;
        if (!textureMatchesSearchQuery(feature, activeQuery)) continue;
        textures.push(feature);
      }

      return { textures, viewportTooWide, unfilteredCount };
    };

    const applyVisible = (options?: { updating?: boolean }) => {
      if (!alive) return;
      const { textures, viewportTooWide, unfilteredCount } = computeVisible();
      setState(() => ({
        textures,
        loading: false,
        updating: options?.updating ?? false,
        viewportTooWide,
        error: null,
        unfilteredCount,
      }));
    };

    recomputeRef.current = () => applyVisible();

    const mergeIntoStore = (incoming: TextureFeature[]) => {
      for (const feature of incoming) {
        globalStoreRef.current.set(getTextureId(feature), feature);
      }
    };

    const fetchBounds = async (bounds: BoundsPayload, signal?: AbortSignal) => {
      const res = await fetch(ATLAS_TEXTURES_API_PATH, {
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
      recomputeRef.current = null;
      inFlightRef.current?.abort();
      map.off("moveend", triggerUpdate);
      map.off("zoomend", triggerUpdate);
      map.off("move", throttledApply);
      throttledApply.cancel();
      if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current);
    };
  }, [mapReady, mapRef]);

  // Re-filter the existing store when search or filters change — no refetch.
  useEffect(() => {
    queryRef.current = { filters, searchQuery };
    recomputeRef.current?.();
  }, [filters, searchQuery, mapReady]);

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
