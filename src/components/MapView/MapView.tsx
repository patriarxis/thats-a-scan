"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  getPartnerId,
  type ILocale,
  type PartnerFeature,
  type VisiblePartnersChangePayload,
} from "@/types";
import {
  declutterDebounceMsForZoom,
  MAP_MOVE_THROTTLE_MS,
  shouldUpdateViewportOnMove,
  throttle,
} from "@/lib/mapViewport";
import { useUserLocation, useViewportStoreQuery } from "@/lib/useMap";
import { ensureMerchantMapLayers } from "./ensureMerchantMapLayers";
import {
  buildMerchantsFeatureCollection,
  type MerchantDeclutterStickyState,
} from "./merchantMapData";
import {
  ACTIVE_PIN_QUICK_ZOOM,
  ATHENS_CENTER,
  ATHENS_INITIAL_ZOOM,
  DECLUTTER_VIEWPORT_DEBOUNCE_MS,
  DOT_LAYER_ID,
  GREECE_MAX_BOUNDS,
  LAYER_ID,
  PREVIEW_SOURCE_ID,
  SELECTED_LAYER_ID,
  SOURCE_ID,
} from "./mapViewConstants";
import { resolveMapStyle } from "./mapViewStyle";
import type { MapViewHandle } from "./mapViewTypes";
import styles from "./MapView.module.scss";

export type { MapViewHandle } from "./mapViewTypes";

type MapViewProps = {
  className?: string;
  locale: ILocale;
  selectedPartnerId: string | null;
  highlightedPartnerIds: string[];
  partnerFilter?: (partner: PartnerFeature) => boolean;
  onVisiblePartnersChange: (payload: VisiblePartnersChangePayload) => void;
  onPartnerSelect: (partner: PartnerFeature) => void;
  onMapClick?: () => void;
};

export const MapView = forwardRef<MapViewHandle, MapViewProps>((
  {
    className,
    locale,
    selectedPartnerId,
    highlightedPartnerIds,
    partnerFilter,
    onVisiblePartnersChange,
    onPartnerSelect,
    onMapClick,
  },
  ref,
) => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const partnersRef = useRef<PartnerFeature[]>([]);
  const onVisiblePartnersChangeRef = useRef(onVisiblePartnersChange);
  const onPartnerSelectRef = useRef(onPartnerSelect);
  const onMapClickRef = useRef(onMapClick);
  const declutterStickyRef = useRef<MerchantDeclutterStickyState>({
    zoomQuantum: Number.NaN,
    cellWinners: new Map(),
  });
  const latestViewportStateRef = useRef({
    partners: [] as PartnerFeature[],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null as string | null,
  });
  const [mapReady, setMapReady] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const { location: userLocation, onGeolocateSuccess, onGeolocateError } = useUserLocation();
  const onGeolocateSuccessRef = useRef(onGeolocateSuccess);
  const onGeolocateErrorRef = useRef(onGeolocateError);
  const { merchants: partners, loading, updating, viewportTooWide, error } = useViewportStoreQuery(
    mapRef,
    userLocation,
    mapReady,
  );

  useEffect(() => {
    setIsLargeScreen(window.innerWidth > 1024);
    const handleResize = () => setIsLargeScreen(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    onVisiblePartnersChangeRef.current = onVisiblePartnersChange;
  }, [onVisiblePartnersChange]);

  useEffect(() => {
    onPartnerSelectRef.current = onPartnerSelect;
  }, [onPartnerSelect]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onGeolocateSuccessRef.current = onGeolocateSuccess;
  }, [onGeolocateSuccess]);

  useEffect(() => {
    onGeolocateErrorRef.current = onGeolocateError;
  }, [onGeolocateError]);

  useEffect(() => {
    partnersRef.current = partners;
  }, [partners]);

  useEffect(() => {
    latestViewportStateRef.current = {
      partners,
      loading,
      updating,
      viewportTooWide,
      error,
    };
  }, [error, loading, partners, updating, viewportTooWide]);

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushDataToMap = useCallback(
    (items: PartnerFeature[]) => {
      const map = mapRef.current;
      if (!map) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      const previewSource = map.getSource(PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
      const alwaysKeep = new Set<string>(highlightedPartnerIds);
      if (selectedPartnerId) alwaysKeep.add(selectedPartnerId);
      const nextData = buildMerchantsFeatureCollection(
        map,
        items,
        alwaysKeep,
        declutterStickyRef.current,
      );
      source?.setData(nextData);
      previewSource?.setData(nextData);
    },
    [highlightedPartnerIds, selectedPartnerId],
  );

  const flushReclutter = useCallback(() => {
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    const map = mapRef.current;
    if (!map) return;
    const latest = latestViewportStateRef.current;
    const nextPartners = latest.partners.filter((partner) =>
      partnerFilter ? partnerFilter(partner) : true,
    );
    pushDataToMap(nextPartners);
    onVisiblePartnersChangeRef.current?.({
      partners: nextPartners,
      loading: latest.loading,
      updating: latest.updating,
      viewportTooWide: latest.viewportTooWide,
      error: latest.error,
    });
  }, [partnerFilter, pushDataToMap]);

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
      const nextZoom =
        options?.preserveHigherZoom ? Math.max(map.getZoom(), zoom) : zoom;
      map.easeTo({ center, zoom: nextZoom, padding, duration: 700 });
    },
    panTo(center, padding) {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({ center, padding, duration: 700 });
    },
  }));

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (token) mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: resolveMapStyle(Boolean(token)),
      center: ATHENS_CENTER,
      zoom: ATHENS_INITIAL_ZOOM,
      antialias: true,
      maxBounds: GREECE_MAX_BOUNDS,
    });
    mapRef.current = map;
    setMapReady(true);

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
    });
    const handleGeolocate = (event: { coords: { latitude: number; longitude: number } }) => {
      onGeolocateSuccessRef.current({
        latitude: event.coords.latitude,
        longitude: event.coords.longitude,
      });
    };
    const handleGeolocateError = () => {
      onGeolocateErrorRef.current("denied");
    };
    geolocateControl.on("geolocate", handleGeolocate);
    geolocateControl.on("error", handleGeolocateError);
    map.addControl(geolocateControl, "bottom-right");

    map.on("load", () => {
      map.setMaxBounds(GREECE_MAX_BOUNDS);
      const minZoomForGreece = map.cameraForBounds(GREECE_MAX_BOUNDS, { padding: 24 })?.zoom;
      if (typeof minZoomForGreece === "number") map.setMinZoom(minZoomForGreece);
      const latest = latestViewportStateRef.current;
      const nextPartners = latest.partners.filter((partner) =>
        partnerFilter ? partnerFilter(partner) : true,
      );
      ensureMerchantMapLayers(map, nextPartners);
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading: latest.loading,
        updating: latest.updating,
        viewportTooWide: latest.viewportTooWide,
        error: latest.error,
      });
    });

    map.on("mouseenter", LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseenter", DOT_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseenter", SELECTED_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseleave", DOT_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseleave", SELECTED_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const merchantId = String(feature.properties?.__merchant_id ?? "");
      const partner = partnersRef.current.find((item) => getPartnerId(item) === merchantId);
      if (partner) {
        onPartnerSelectRef.current?.(partner);
      }
    });
    map.on("click", DOT_LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const merchantId = String(feature.properties?.__merchant_id ?? "");
      const partner = partnersRef.current.find((item) => getPartnerId(item) === merchantId);
      if (partner) {
        onPartnerSelectRef.current?.(partner);
      }
    });
    map.on("click", SELECTED_LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const merchantId = String(feature.properties?.__merchant_id ?? "");
      const partner = partnersRef.current.find((item) => getPartnerId(item) === merchantId);
      if (partner) {
        onPartnerSelectRef.current?.(partner);
        const targetZoom = Math.max(map.getZoom(), ACTIVE_PIN_QUICK_ZOOM);
        map.easeTo({
          center: partner.geometry.coordinates as [number, number],
          zoom: targetZoom,
          duration: 450,
        });
      }
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [DOT_LAYER_ID, LAYER_ID, SELECTED_LAYER_ID],
      });
      if (!features.length) {
        onMapClickRef.current?.();
      }
    });

    return () => {
      geolocateControl.off("geolocate", handleGeolocate);
      geolocateControl.off("error", handleGeolocateError);
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;
    const apply = () => map.setLanguage(locale);
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [locale, token]);

  // Immediate-flush path: triggered by user-signal changes (filter, selection, highlights,
  // initial load completion). Layers are (re)ensured here so the first paint after a style
  // load is correct.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncImmediate = () => {
      const latest = latestViewportStateRef.current;
      const nextPartners = latest.partners.filter((partner) =>
        partnerFilter ? partnerFilter(partner) : true,
      );
      ensureMerchantMapLayers(map, nextPartners);
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading: latest.loading,
        updating: latest.updating,
        viewportTooWide: latest.viewportTooWide,
        error: latest.error,
      });
    };

    if (map.isStyleLoaded()) {
      syncImmediate();
      return;
    }
    map.once("load", syncImmediate);
    return () => {
      map.off("load", syncImmediate);
    };
  }, [error, loading, partnerFilter, pushDataToMap, updating, viewportTooWide]);

  // Debounced-schedule path: triggered only by `partners` list churn (every debounced moveend
  // from useMap.ts). Single shared timer with `flushReclutter` so user-signal changes can flush.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    scheduleReclutter();
  }, [partners, scheduleReclutter]);

  // Throttled reclutter while panning at street zoom so pins track the buffered viewport.
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

  // Cleanup the shared timer on unmount.
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(DOT_LAYER_ID)) map.setLayoutProperty(DOT_LAYER_ID, "visibility", "visible");
    if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "visible");
    if (map.getLayer(SELECTED_LAYER_ID)) {
      map.setLayoutProperty(
        SELECTED_LAYER_ID,
        "visibility",
        selectedPartnerId ? "visible" : "none",
      );
    }
  }, [selectedPartnerId, viewportTooWide]);

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
    if (!map || !userLocation) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      return;
    }

    const markerEl = document.createElement("div");
    markerEl.style.width = "16px";
    markerEl.style.height = "16px";
    markerEl.style.borderRadius = "9999px";
    markerEl.style.background = "rgba(59, 130, 246, 0.85)";
    markerEl.style.border = "2px solid #ffffff";
    markerEl.style.boxShadow = "0 0 0 8px rgba(59,130,246,0.15)";

    userMarkerRef.current = new mapboxgl.Marker({ element: markerEl })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(SELECTED_LAYER_ID) || !map.getLayer(LAYER_ID)) return;
    const selectedId = selectedPartnerId ?? null;
    map.setFilter(
      SELECTED_LAYER_ID,
      selectedId
        ? ["==", ["get", "__merchant_id"], selectedId]
        : ["==", "__merchant_id", "__none__"],
    );
    map.setFilter(
      LAYER_ID,
      selectedId
        ? [
            "all",
            ["==", ["get", "__marker_state"], "default"],
            ["!=", ["get", "__merchant_id"], selectedId],
          ]
        : ["==", ["get", "__marker_state"], "default"],
    );
    if (map.getLayer(DOT_LAYER_ID)) {
      map.setFilter(
        DOT_LAYER_ID,
        selectedId
          ? [
              "all",
              ["==", ["get", "__marker_state"], "small"],
              ["!=", ["get", "__merchant_id"], selectedId],
            ]
          : ["==", ["get", "__marker_state"], "small"],
      );
    }
  }, [highlightedPartnerIds, selectedPartnerId]);

  return (
    <div className={styles.wrapper}>
      <div ref={mapContainerRef} className={className ?? styles.mapContainer} />
    </div>
  );
});
