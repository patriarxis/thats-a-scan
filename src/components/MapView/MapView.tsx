"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type TextureFeature, type VisibleTexturesPayload } from "@/domain/textures/types";
import type { TextureFilterState } from "@/domain/textures/filters";
import { strings } from "@/content/strings";
import {
  declutterDebounceMsForZoom,
  MAP_MOVE_THROTTLE_MS,
  shouldUpdateViewportOnMove,
  throttle,
} from "@/lib/mapViewport";
import { useUserLocation } from "@/shared/hooks/useUserLocation";
import { useViewportTextureQuery } from "@/features/map/hooks/useViewportTextures";
import { ensureTextureMapLayers } from "./ensureTextureMapLayers";
import {
  buildTexturesFeatureCollection,
  dedupeByTextureId,
  type TextureDeclutterStickyState,
} from "./textureMapData";
import { TextureMarkerFadeAnimator } from "./textureMarkerFade";
import { mergeTexturesIntoStore, textureFromMapFeature } from "./textureClick";
import {
  ATHENS_CENTER,
  ATHENS_INITIAL_ZOOM,
  ATHENS_MAX_BOUNDS,
  DECLUTTER_VIEWPORT_DEBOUNCE_MS,
  DOT_LAYER_ID,
  LAYER_ID,
  MAP_MIN_ZOOM,
  PREVIEW_SOURCE_ID,
  SELECTED_LAYER_ID,
  SOURCE_ID,
} from "./mapViewConstants";
import { LocateControl } from "./locateControl";
import { resolveMapStyle } from "./mapViewStyle";
import type { MapViewHandle } from "./mapViewTypes";
import styles from "./MapView.module.scss";

export type { MapViewHandle } from "./mapViewTypes";

const CLICK_LAYERS = [LAYER_ID, DOT_LAYER_ID, SELECTED_LAYER_ID] as const;

type MapViewProps = {
  className?: string;
  selectedTextureId: string | null;
  filters?: TextureFilterState;
  searchQuery?: string;
  /** Search hits — kept at full size through declutter. */
  searchPinnedIds?: ReadonlySet<string>;
  onVisibleTexturesChange: (payload: VisibleTexturesPayload) => void;
  onTextureSelect: (texture: TextureFeature) => void;
  onMapClick?: () => void;
};

export const MapView = forwardRef<MapViewHandle, MapViewProps>((
  {
    className,
    selectedTextureId,
    filters,
    searchQuery,
    searchPinnedIds,
    onVisibleTexturesChange,
    onTextureSelect,
    onMapClick,
  },
  ref,
) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const textureByIdRef = useRef<Map<string, TextureFeature>>(new Map());
  const onVisibleTexturesChangeRef = useRef(onVisibleTexturesChange);
  const onTextureSelectRef = useRef(onTextureSelect);
  const onMapClickRef = useRef(onMapClick);
  const selectedTextureIdRef = useRef(selectedTextureId);
  const declutterStickyRef = useRef<TextureDeclutterStickyState>({
    zoomQuantum: Number.NaN,
    cellWinners: new Map(),
  });
  const markerFadeRef = useRef<TextureMarkerFadeAnimator | null>(null);
  const latestViewportStateRef = useRef({
    textures: [] as TextureFeature[],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null as string | null,
  });
  const searchPinnedIdsRef = useRef<ReadonlySet<string>>(searchPinnedIds ?? new Set());
  searchPinnedIdsRef.current = searchPinnedIds ?? new Set();
  const [mapReady, setMapReady] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [locateStatus, setLocateStatus] = useState<{ message: string; tone: "neutral" | "error" } | null>(
    null,
  );
  const locateStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { location: userLocation, onGeolocateSuccess, onGeolocateError } = useUserLocation();
  const onGeolocateSuccessRef = useRef(onGeolocateSuccess);
  const onGeolocateErrorRef = useRef(onGeolocateError);
  const { textures, loading, updating, viewportTooWide, error, unfilteredCount } =
    useViewportTextureQuery(mapRef, userLocation, mapReady, { filters, searchQuery });

  // Something is in view, but nothing survived the active search/filters.
  const showNoResults =
    !loading && textures.length === 0 && unfilteredCount > 0 && !viewportTooWide;

  useEffect(() => {
    setIsLargeScreen(window.innerWidth > 1024);
    const handleResize = () => setIsLargeScreen(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { onVisibleTexturesChangeRef.current = onVisibleTexturesChange; }, [onVisibleTexturesChange]);
  useEffect(() => { onTextureSelectRef.current = onTextureSelect; }, [onTextureSelect]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onGeolocateSuccessRef.current = onGeolocateSuccess; }, [onGeolocateSuccess]);
  useEffect(() => { onGeolocateErrorRef.current = onGeolocateError; }, [onGeolocateError]);
  useEffect(() => { selectedTextureIdRef.current = selectedTextureId; }, [selectedTextureId]);
  useEffect(() => () => {
    if (locateStatusTimerRef.current) clearTimeout(locateStatusTimerRef.current);
  }, []);

  const showLocateStatus = useCallback((message: string, tone: "neutral" | "error" = "neutral") => {
    setLocateStatus({ message, tone });
    if (locateStatusTimerRef.current) clearTimeout(locateStatusTimerRef.current);
    locateStatusTimerRef.current = setTimeout(() => {
      locateStatusTimerRef.current = null;
      setLocateStatus(null);
    }, tone === "error" ? 7000 : 3500);
  }, []);
  const showLocateStatusRef = useRef(showLocateStatus);
  useEffect(() => { showLocateStatusRef.current = showLocateStatus; }, [showLocateStatus]);
  useEffect(() => {
    latestViewportStateRef.current = { textures, loading, updating, viewportTooWide, error };
  }, [error, loading, textures, updating, viewportTooWide]);

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFeatureCollectionToMap = useCallback((features: TextureFeature[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const previewSource = map.getSource(PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    const nextData = { type: "FeatureCollection" as const, features };
    source?.setData(nextData);
    previewSource?.setData(nextData);
  }, []);

  const pushDataToMap = useCallback((viewportItems: TextureFeature[]) => {
    const map = mapRef.current;
    if (!map) return;

    ensureTextureMapLayers(map, viewportItems);
    mergeTexturesIntoStore(textureByIdRef.current, viewportItems);

    const alwaysKeep = new Set<string>();
    const selectedId = selectedTextureIdRef.current;
    if (selectedId) alwaysKeep.add(selectedId);

    const searchPinned = searchPinnedIdsRef.current;

    const nextData = buildTexturesFeatureCollection(
      map,
      dedupeByTextureId(viewportItems),
      alwaysKeep,
      declutterStickyRef.current,
      searchPinned,
      selectedId,
    );

    if (!markerFadeRef.current) {
      markerFadeRef.current = new TextureMarkerFadeAnimator();
    }
    // Search hits must survive declutter fade-out as well as state assignment.
    const neverFadeOut = new Set<string>(searchPinned);
    if (selectedId) neverFadeOut.add(selectedId);
    markerFadeRef.current.sync(nextData.features, applyFeatureCollectionToMap, neverFadeOut);
  }, [applyFeatureCollectionToMap]);

  const pushDataToMapRef = useRef(pushDataToMap);
  useEffect(() => { pushDataToMapRef.current = pushDataToMap; }, [pushDataToMap]);

  const flushReclutter = useCallback(() => {
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    const latest = latestViewportStateRef.current;
    pushDataToMap(latest.textures);
    onVisibleTexturesChangeRef.current?.({
      textures: latest.textures,
      loading: latest.loading,
      updating: latest.updating,
      viewportTooWide: latest.viewportTooWide,
      error: latest.error,
    });
  }, [pushDataToMap]);

  const scheduleReclutter = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    const map = mapRef.current;
    const delay = map ? declutterDebounceMsForZoom(map.getZoom()) : DECLUTTER_VIEWPORT_DEBOUNCE_MS;
    if (delay === 0) {
      flushReclutter();
      return;
    }
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      flushReclutter();
    }, delay);
  }, [flushReclutter]);

  useImperativeHandle(ref, () => ({
    flyTo(center, zoom = 14, padding, options) {
      const map = mapRef.current;
      if (!map) return;
      const nextZoom = options?.preserveHigherZoom ? Math.max(map.getZoom(), zoom) : zoom;
      map.easeTo({
        center,
        zoom: nextZoom,
        duration: 700,
        ...(padding ? { padding } : {}),
      });
    },
    panTo(center, padding) {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center,
        duration: 700,
        ...(padding ? { padding } : {}),
      });
    },
  }));

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolveMapStyle(),
      center: ATHENS_CENTER,
      zoom: ATHENS_INITIAL_ZOOM,
      maxBounds: ATHENS_MAX_BOUNDS,
    });
    mapRef.current = map;
    setMapReady(true);

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    const locateControl = new LocateControl({
      onSuccess: (coords) => onGeolocateSuccessRef.current(coords),
      onError: (permission) => onGeolocateErrorRef.current(permission),
      onStatus: (message, tone) => showLocateStatusRef.current(message, tone ?? "neutral"),
    });
    map.addControl(locateControl, "bottom-right");

    const selectTextureFromClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const mapFeature = e.features?.[0];
      if (!mapFeature) return false;

      const texture = textureFromMapFeature(mapFeature, textureByIdRef.current);
      if (!texture) return false;

      onTextureSelectRef.current?.(texture);
      return true;
    };

    map.on("load", () => {
      map.setMaxBounds(ATHENS_MAX_BOUNDS);
      map.setMinZoom(MAP_MIN_ZOOM);

      const latest = latestViewportStateRef.current;
      ensureTextureMapLayers(map, latest.textures);
      mergeTexturesIntoStore(textureByIdRef.current, latest.textures);
      pushDataToMapRef.current(latest.textures);
      onVisibleTexturesChangeRef.current?.({
        textures: latest.textures,
        loading: latest.loading,
        updating: latest.updating,
        viewportTooWide: latest.viewportTooWide,
        error: latest.error,
      });
    });

    const setPointer = () => { map.getCanvas().style.cursor = "pointer"; };
    const clearPointer = () => { map.getCanvas().style.cursor = ""; };
    for (const layerId of CLICK_LAYERS) {
      map.on("mouseenter", layerId, setPointer);
      map.on("mouseleave", layerId, clearPointer);
    }

    for (const layerId of [LAYER_ID, DOT_LAYER_ID]) {
      map.on("click", layerId, (e) => {
        selectTextureFromClick(e);
      });
    }

    map.on("click", SELECTED_LAYER_ID, (e) => {
      selectTextureFromClick(e);
    });

    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [...CLICK_LAYERS] });
      if (!hit.length) onMapClickRef.current?.();
    });

    return () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      markerFadeRef.current?.dispose();
      markerFadeRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncImmediate = () => {
      const latest = latestViewportStateRef.current;
      ensureTextureMapLayers(map, latest.textures);
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      pushDataToMap(latest.textures);
      onVisibleTexturesChangeRef.current?.({
        textures: latest.textures,
        loading: latest.loading,
        updating: latest.updating,
        viewportTooWide: latest.viewportTooWide,
        error: latest.error,
      });
    };

    if (map.isStyleLoaded()) syncImmediate();
    else map.once("load", syncImmediate);

    return () => { map.off("load", syncImmediate); };
  }, [error, loading, pushDataToMap, selectedTextureId, textures, updating, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    scheduleReclutter();
  }, [textures, scheduleReclutter]);

  // Pinning a new search hit changes marker states without changing the set.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    scheduleReclutter();
  }, [searchPinnedIds, scheduleReclutter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const throttledReclutter = throttle(() => {
      if (!map.isStyleLoaded()) return;
      if (!shouldUpdateViewportOnMove(map.getZoom())) return;
      flushReclutter();
    }, MAP_MOVE_THROTTLE_MS);
    map.on("move", throttledReclutter);
    return () => {
      map.off("move", throttledReclutter);
      throttledReclutter.cancel();
    };
  }, [flushReclutter, mapReady]);

  useEffect(() => () => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(DOT_LAYER_ID)) map.setLayoutProperty(DOT_LAYER_ID, "visibility", "visible");
    if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "visible");
    if (map.getLayer(SELECTED_LAYER_ID)) {
      map.setLayoutProperty(SELECTED_LAYER_ID, "visibility", selectedTextureId ? "visible" : "none");
    }
  }, [selectedTextureId, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(SELECTED_LAYER_ID)) return;
    map.setLayoutProperty(
      SELECTED_LAYER_ID,
      "icon-offset",
      isLargeScreen ? ([0, 0] as [number, number]) : ([0, -14] as [number, number]),
    );
  }, [isLargeScreen, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userLocation) return;

    if (!userLocation.inCatalog) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      return;
    }
    const markerEl = document.createElement("div");
    markerEl.style.cssText =
      "width:16px;height:16px;border-radius:9999px;background:rgba(255,133,0,0.92);border:2px solid #ececec;box-shadow:0 0 0 8px rgba(255,133,0,0.18)";
    userMarkerRef.current = new maplibregl.Marker({ element: markerEl })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
  }, [mapReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(SELECTED_LAYER_ID) || !map.getLayer(LAYER_ID)) return;
    const selectedId = selectedTextureId ?? null;
    map.setFilter(
      SELECTED_LAYER_ID,
      selectedId ? ["==", ["get", "__texture_id"], selectedId] : ["==", "__texture_id", "__none__"],
    );
    map.setFilter(
      LAYER_ID,
      selectedId
        ? ["all", ["==", ["get", "__marker_state"], "default"], ["!=", ["get", "__texture_id"], selectedId]]
        : ["==", ["get", "__marker_state"], "default"],
    );
    if (map.getLayer(DOT_LAYER_ID)) {
      map.setFilter(
        DOT_LAYER_ID,
        selectedId
          ? ["all", ["==", ["get", "__marker_state"], "small"], ["!=", ["get", "__texture_id"], selectedId]]
          : ["==", ["get", "__marker_state"], "small"],
      );
    }
  }, [selectedTextureId]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={mapContainerRef}
        className={[styles.mapSurface, className ?? styles.mapContainer].filter(Boolean).join(" ")}
      />
      <div className={styles.mapOverlay} aria-hidden />
      {showNoResults ? (
        <div className={styles.noResults} role="status">
          {strings.noResults}
        </div>
      ) : null}
      {locateStatus ? (
        <div
          className={[
            styles.locateStatus,
            locateStatus.tone === "error" ? styles.locateStatusError : styles.locateStatusNeutral,
          ].join(" ")}
          role="status"
        >
          {locateStatus.message}
        </div>
      ) : null}
    </div>
  );
});

MapView.displayName = "MapView";
