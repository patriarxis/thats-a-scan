"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  getPartnerId,
  type ILocale,
  type PartnerFeature,
  type VisiblePartnersChangePayload,
} from "@/types";
import { useUserLocation, useViewportStoreQuery } from "@/lib/useMap";
import { ensureMerchantMapLayers } from "./ensureMerchantMapLayers";
import { buildMerchantsFeatureCollection } from "./merchantMapData";
import {
  ATHENS_CENTER,
  ATHENS_INITIAL_ZOOM,
  DOT_LAYER_ID,
  GREECE_MAX_BOUNDS,
  HEATMAP_LAYER_ID,
  HEATMAP_SOURCE_ID,
  HIGHLIGHT_LAYER_ID,
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
  zoomInMessage: string;
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
    zoomInMessage,
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
  const heatmapLoadedRef = useRef(false);
  const latestViewportStateRef = useRef({
    partners: [] as PartnerFeature[],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null as string | null,
  });
  const [mapReady, setMapReady] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const userLocation = useUserLocation();
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

  const pushDataToMap = (items: PartnerFeature[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const previewSource = map.getSource(PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    const nextData = buildMerchantsFeatureCollection(map, items);
    source?.setData(nextData);
    previewSource?.setData(nextData);
  };

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
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "bottom-right",
    );

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncData = () => {
      const nextPartners = partners.filter((partner) =>
        partnerFilter ? partnerFilter(partner) : true,
      );
      ensureMerchantMapLayers(map, nextPartners);
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading,
        updating,
        error,
      });
    };

    if (map.isStyleLoaded()) {
      syncData();
      return;
    }

    map.once("load", syncData);
    return () => {
      map.off("load", syncData);
    };
  }, [error, loading, partnerFilter, partners, updating, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncForCurrentZoom = () => {
      const latest = latestViewportStateRef.current;
      const nextPartners = latest.partners.filter((partner) =>
        partnerFilter ? partnerFilter(partner) : true,
      );
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading: latest.loading,
        updating: latest.updating,
        error: latest.error,
      });
    };

    map.on("zoomend", syncForCurrentZoom);
    map.on("moveend", syncForCurrentZoom);
    return () => {
      map.off("zoomend", syncForCurrentZoom);
      map.off("moveend", syncForCurrentZoom);
    };
  }, [partnerFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const showHeatmap = viewportTooWide;
    const heatmapVisibility = showHeatmap ? "visible" : "none";
    const regularVisibility = showHeatmap ? "none" : "visible";
    if (map.getLayer(HEATMAP_LAYER_ID)) map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", heatmapVisibility);
    if (map.getLayer(DOT_LAYER_ID)) map.setLayoutProperty(DOT_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.setLayoutProperty(HIGHLIGHT_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(SELECTED_LAYER_ID)) map.setLayoutProperty(SELECTED_LAYER_ID, "visibility", regularVisibility);
  }, [viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !viewportTooWide || heatmapLoadedRef.current) return;
    const source = map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData("/api/heatmap");
    heatmapLoadedRef.current = true;
  }, [mapReady, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !viewportTooWide) return;

    let rafId: number;
    const start = Date.now();

    const animate = () => {
      if (!map.getLayer(HEATMAP_LAYER_ID)) return;

      const elapsed = Date.now() - start;
      const pulse = 0.82 + Math.sin(elapsed / 700) * 0.18;

      map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.65 * pulse,
        8,
        0.55 * pulse,
        10.5,
        0.3 * pulse,
        11,
        0,
      ]);

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-opacity", [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 0.65,
          8, 0.55,
          10.5, 0.3,
          11, 0,
        ]);
      }
    };
  }, [mapReady, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer(HEATMAP_LAYER_ID)) {
      map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        isLargeScreen ? 25 : 15,
        8,
        isLargeScreen ? 40 : 25,
        12,
        isLargeScreen ? 60 : 40,
      ]);
    }
  }, [isLargeScreen, mapReady]);

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
    if (!map || !map.getLayer(HIGHLIGHT_LAYER_ID) || !map.getLayer(SELECTED_LAYER_ID) || !map.getLayer(LAYER_ID)) return;
    const selectedId = selectedPartnerId ?? null;
    const ringIds = Array.from(new Set(highlightedPartnerIds));
    map.setFilter(
      HIGHLIGHT_LAYER_ID,
      ringIds.length > 0
        ? ["in", ["get", "__merchant_id"], ["literal", ringIds]]
        : ["==", "__merchant_id", "__none__"],
    );
    map.setFilter(
      SELECTED_LAYER_ID,
      selectedId
        ? ["==", ["get", "__merchant_id"], selectedId]
        : ["==", "__merchant_id", "__none__"],
    );
    map.setFilter(LAYER_ID, selectedId ? ["!=", ["get", "__merchant_id"], selectedId] : null);
    if (map.getLayer(DOT_LAYER_ID)) {
      map.setFilter(DOT_LAYER_ID, selectedId ? ["!=", ["get", "__merchant_id"], selectedId] : null);
    }
  }, [highlightedPartnerIds, selectedPartnerId]);

  return (
    <div className={styles.wrapper}>
      {viewportTooWide && (
        <div className={styles.zoomMessage}>
          {zoomInMessage}
        </div>
      )}
      <div ref={mapContainerRef} className={className ?? styles.mapContainer} />
    </div>
  );
});
