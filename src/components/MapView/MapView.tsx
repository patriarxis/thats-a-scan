"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  getPartnerId,
  type PartnerFeature,
  type VisiblePartnersChangePayload,
} from "@/types";
import { resolveMerchantCategoryFromProperties } from "@/lib/merchantFilters";
import { useUserLocation, useViewportStoreQuery } from "@/lib/useMap";
import styles from "./MapView.module.scss";

const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
const ATHENS_INITIAL_ZOOM = 11;
const GREECE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [18.85, 34.24],
  [28.75, 42.16]
];
const SOURCE_ID = "merchants-source";
const PREVIEW_SOURCE_ID = "merchants-preview-source";
const HEATMAP_SOURCE_ID = "merchants-heatmap-source";
const LAYER_ID = "merchants-markers";
const SELECTED_LAYER_ID = "merchants-markers-selected";
const CLUSTER_LAYER_ID = "merchants-clusters";
const CLUSTER_GLOW_LAYER_ID = "merchants-clusters-glow";
const CLUSTER_COUNT_LAYER_ID = "merchants-cluster-count";
const HIGHLIGHT_LAYER_ID = "merchants-highlight";
const HEATMAP_LAYER_ID = "merchants-heatmap";
const CLUSTER_MAX_ZOOM = 13;
const CLUSTER_RADIUS = 48;
const MARKER_ICON_MEAL_ID = "merchant-marker-meal";
const MARKER_ICON_REWARDS_ID = "merchant-marker-rewards";
const MARKER_ICON_EXPENSES_ID = "merchant-marker-expenses";
const MARKER_ICON_GYMS_ID = "merchant-marker-gyms";
const MARKER_ICON_DEFAULT_ID = MARKER_ICON_REWARDS_ID;
const MAPBOX_DARK_STYLE_URL = "mapbox://styles/mapbox/dark-v11";
const CARTO_DARK_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    cartoDark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  layers: [{ id: "carto-dark", type: "raster", source: "cartoDark" }]
};

type MapViewProps = {
  className?: string;
  selectedPartnerId: string | null;
  highlightedPartnerIds: string[];
  zoomInMessage: string;
  partnerFilter?: (partner: PartnerFeature) => boolean;
  onVisiblePartnersChange: (payload: VisiblePartnersChangePayload) => void;
  onPartnerSelect: (partner: PartnerFeature) => void;
  onMapClick?: () => void;
  // Backward-compatible props during migration.
  selectedMerchantId?: string | null;
  highlightedMerchantIds?: string[];
  merchantFilter?: (merchant: PartnerFeature) => boolean;
  onVisibleMerchantsChange?: (payload: { merchants: PartnerFeature[]; loading: boolean; updating: boolean; error: string | null }) => void;
  onMerchantSelect?: (merchant: PartnerFeature) => void;
};

type MarkerCategory = "meal" | "rewards" | "expenses" | "gyms";

type MarkerIconConfig = {
  id: string;
  primaryColor: string;
  darkBgColor: string;
  glyph: string;
};

const MARKER_ICON_CONFIG: Record<MarkerCategory, MarkerIconConfig> = {
  meal: {
    id: MARKER_ICON_MEAL_ID,
    primaryColor: "#f59e0b",
    darkBgColor: "#451a03",
    glyph: "🍽"
  },
  rewards: {
    id: MARKER_ICON_REWARDS_ID,
    primaryColor: "#8f499c",
    darkBgColor: "#201023",
    glyph: "🎁"
  },
  expenses: {
    id: MARKER_ICON_EXPENSES_ID,
    primaryColor: "#3b82f6",
    darkBgColor: "#0b1f3b",
    glyph: "💼"
  },
  gyms: {
    id: MARKER_ICON_GYMS_ID,
    primaryColor: "#ef4444",
    darkBgColor: "#3f1212",
    glyph: "🏋"
  }
};

export type MapViewHandle = {
  flyTo: (
    center: [number, number],
    zoom?: number,
    padding?: mapboxgl.PaddingOptions,
    options?: { preserveHigherZoom?: boolean },
  ) => void;
};

const withClientIds = (features: PartnerFeature[]): PartnerFeature[] =>
  features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      __merchant_id: getPartnerId(feature),
      __marker_icon: getMarkerIconId(feature.properties)
    }
  }));
;

const getMarkerIconId = (properties: Record<string, unknown>): string =>
  MARKER_ICON_CONFIG[resolveMerchantCategoryFromProperties(properties)].id;

const ensureMarkerIcon = (map: MapboxMap, icon: MarkerIconConfig) => {
  if (map.hasImage(icon.id)) return;
  // Target design:
  // - icon: 1rem (16px)
  // - padding: 0.5rem (8px)
  // - border: 1px
  // -> visual diameter: 32px
  const displaySize = 32;
  const size = displaySize * 2;
  const center = size / 2;
  const borderWidth = 2; // 1 CSS px at pixelRatio: 2
  const radius = center - borderWidth;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = icon.darkBgColor;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = icon.primaryColor;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "600 32px -apple-system, BlinkMacSystemFont, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon.glyph, center, center + 1);

  map.addImage(icon.id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
};

const ensureMarkerIcons = (map: MapboxMap) => {
  for (const icon of Object.values(MARKER_ICON_CONFIG)) {
    ensureMarkerIcon(map, icon);
  }
};

const ensureMapLayers = (map: MapboxMap) => {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS
    });
  }

  if (!map.getSource(PREVIEW_SOURCE_ID)) {
    map.addSource(PREVIEW_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }

  if (!map.getSource(HEATMAP_SOURCE_ID)) {
    map.addSource(HEATMAP_SOURCE_ID, {
      type: "geojson",
      data: "/api/heatmap",
      buffer: 0 // No need for buffer on heatmap points
    });
  }

  ensureMarkerIcons(map);

  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1a1a1a",
        "circle-radius": ["step", ["get", "point_count"], 20, 20, 28, 80, 35],
        "circle-stroke-color": "rgba(255, 255, 255, 0.1)",
        "circle-stroke-width": 2
      }
    });
  }

  if (!map.getLayer(CLUSTER_GLOW_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_GLOW_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "rgba(143, 73, 156, 0.42)",
        "circle-blur": 0.9,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          ["step", ["get", "point_count"], 26, 20, 34, 80, 42],
          9,
          ["step", ["get", "point_count"], 24, 20, 32, 80, 40],
          12,
          ["step", ["get", "point_count"], 21, 20, 29, 80, 36]
        ],
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.72,
          8.5,
          0.58,
          10.5,
          0.28,
          12,
          0.12,
          13,
          0
        ]
      }
    }, CLUSTER_LAYER_ID);
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 12,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"]
      },
      paint: { "text-color": "#ffffff" }
    });
  }

  if (!map.getLayer(HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_LAYER_ID,
      type: "heatmap",
      source: HEATMAP_SOURCE_ID,
      maxzoom: 11,
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          0,
          0,
          1,
          0.1,
          10,
          0.5,
          50,
          1
        ],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.7,
          8,
          1.1,
          10,
          1.4
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          (window?.innerWidth > 1024 ? 25 : 15),
          8,
          (window?.innerWidth > 1024 ? 40 : 25),
          12,
          (window?.innerWidth > 1024 ? 60 : 40)
        ],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.65,
          8,
          0.55,
          10.5,
          0.3,
          11,
          0
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.1,
          "rgba(253, 186, 116, 0.15)",
          0.35,
          "rgba(251, 146, 60, 0.35)",
          0.7,
          "rgba(249, 115, 22, 0.6)",
          1,
          "rgba(255, 255, 255, 0.8)"
        ]
      }
    }, CLUSTER_GLOW_LAYER_ID);
  }

  if (!map.getLayer(HIGHLIGHT_LAYER_ID)) {
    map.addLayer({
      id: HIGHLIGHT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", "__merchant_id", "__none__"],
      paint: {
        "circle-radius": 24,
        "circle-color": "rgba(15,23,42,0.24)",
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(226,232,240,0.65)"
      }
    });
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["coalesce", ["get", "__marker_icon"], MARKER_ICON_DEFAULT_ID],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.92, 12, 1, 15, 1.08],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-anchor": "center"
      }
    });
  }

  if (!map.getLayer(SELECTED_LAYER_ID)) {
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["==", "__merchant_id", "__none__"],
      layout: {
        "icon-image": ["coalesce", ["get", "__marker_icon"], MARKER_ICON_DEFAULT_ID],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.92, 12, 1, 15, 1.08],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-anchor": "center"
      }
    });
  }

  // Keep highlight rings above regular markers, but still below the selected marker icon.
  if (map.getLayer(HIGHLIGHT_LAYER_ID) && map.getLayer(SELECTED_LAYER_ID)) {
    map.moveLayer(HIGHLIGHT_LAYER_ID, SELECTED_LAYER_ID);
  }
};

const resolveMapStyle = (hasToken: boolean) =>
  hasToken ? MAPBOX_DARK_STYLE_URL : CARTO_DARK_STYLE;

export const MapView = forwardRef<MapViewHandle, MapViewProps>((
  {
    className,
    selectedPartnerId,
    highlightedPartnerIds,
    zoomInMessage,
    partnerFilter,
    onVisiblePartnersChange,
    onPartnerSelect,
    selectedMerchantId,
    highlightedMerchantIds,
    merchantFilter,
    onVisibleMerchantsChange,
    onMerchantSelect,
    onMapClick
  },
  ref
) => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const partnersRef = useRef<PartnerFeature[]>([]);
  const onVisiblePartnersChangeRef = useRef(onVisiblePartnersChange);
  const onPartnerSelectRef = useRef(onPartnerSelect);
  const onMapClickRef = useRef(onMapClick);
  const latestViewportStateRef = useRef({
    partners: [] as PartnerFeature[],
    loading: true,
    updating: false,
    viewportTooWide: false,
    error: null as string | null
  });
  const [mapReady, setMapReady] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const userLocation = useUserLocation();
  const { merchants: partners, loading, updating, viewportTooWide, error } = useViewportStoreQuery(
    mapRef,
    userLocation,
    mapReady
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
      error
    };
  }, [error, loading, partners, updating, viewportTooWide]);

  const pushDataToMap = (items: PartnerFeature[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const previewSource = map.getSource(PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    const nextData = {
      type: "FeatureCollection",
      features: withClientIds(items)
    } as GeoJSON.FeatureCollection;
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
    }
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
      maxBounds: GREECE_MAX_BOUNDS
    });
    mapRef.current = map;
    setMapReady(true);

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false
      }),
      "bottom-right"
    );

    map.on("load", () => {
      map.setMaxBounds(GREECE_MAX_BOUNDS);
      const minZoomForGreece = map.cameraForBounds(GREECE_MAX_BOUNDS, { padding: 24 })?.zoom;
      if (typeof minZoomForGreece === "number") map.setMinZoom(minZoomForGreece);
      ensureMapLayers(map);
      const latest = latestViewportStateRef.current;
      const nextPartners = latest.partners.filter((partner) =>
        (partnerFilter ?? merchantFilter) ? (partnerFilter ?? merchantFilter)!(partner) : true
      );
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading: latest.loading,
        updating: latest.updating,
        error: latest.error
      });
      onVisibleMerchantsChange?.({
        merchants: nextPartners,
        loading: latest.loading,
        updating: latest.updating,
        error: latest.error
      });
    });

    map.on("mouseenter", LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseenter", SELECTED_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseenter", CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseleave", SELECTED_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseleave", CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", CLUSTER_LAYER_ID, (e) => {
      const clusterFeature = e.features?.[0];
      if (!clusterFeature || clusterFeature.geometry.type !== "Point") return;
      const clusterId = Number(clusterFeature.properties?.cluster_id);
      if (!Number.isFinite(clusterId)) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || typeof zoom !== "number") return;
        map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom, duration: 550 });
      });
    });

    map.on("click", LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const merchantId = String(feature.properties?.__merchant_id ?? "");
      const partner = partnersRef.current.find((item) => getPartnerId(item) === merchantId);
      if (partner) {
        onPartnerSelectRef.current?.(partner);
        onMerchantSelect?.(partner);
      }
    });
    map.on("click", SELECTED_LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const merchantId = String(feature.properties?.__merchant_id ?? "");
      const partner = partnersRef.current.find((item) => getPartnerId(item) === merchantId);
      if (partner) {
        onPartnerSelectRef.current?.(partner);
        onMerchantSelect?.(partner);
      }
    });

    map.on("click", (e) => {
      // If the click hit a merchant marker or cluster, we let those specific handlers work.
      // queryRenderedFeatures is the most reliable way to check for generic map click vs feature click.
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_ID, SELECTED_LAYER_ID, CLUSTER_LAYER_ID]
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
    if (!map) return;

    const syncData = () => {
      ensureMapLayers(map);
      const nextPartners = partners.filter((partner) =>
        (partnerFilter ?? merchantFilter) ? (partnerFilter ?? merchantFilter)!(partner) : true
      );
      pushDataToMap(nextPartners);
      onVisiblePartnersChangeRef.current?.({
        partners: nextPartners,
        loading,
        updating,
        error
      });
      onVisibleMerchantsChange?.({
        merchants: nextPartners,
        loading,
        updating,
        error
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
  }, [error, loading, merchantFilter, onVisibleMerchantsChange, partnerFilter, partners, updating, viewportTooWide]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const showHeatmap = viewportTooWide;
    const heatmapVisibility = showHeatmap ? "visible" : "none";
    const regularVisibility = showHeatmap ? "none" : "visible";
    if (map.getLayer(HEATMAP_LAYER_ID)) map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", heatmapVisibility);
    if (map.getLayer(CLUSTER_GLOW_LAYER_ID)) map.setLayoutProperty(CLUSTER_GLOW_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(CLUSTER_LAYER_ID)) map.setLayoutProperty(CLUSTER_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.setLayoutProperty(HIGHLIGHT_LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", regularVisibility);
    if (map.getLayer(SELECTED_LAYER_ID)) map.setLayoutProperty(SELECTED_LAYER_ID, "visibility", regularVisibility);
  }, [viewportTooWide]);

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
        0
      ]);

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      // Reset opacity when animation stops
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-opacity", [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 0.65,
          8, 0.55,
          10.5, 0.3,
          11, 0
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
        (isLargeScreen ? 25 : 15),
        8,
        (isLargeScreen ? 40 : 25),
        12,
        (isLargeScreen ? 60 : 40)
      ]);
    }
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
    const selectedId = selectedPartnerId ?? selectedMerchantId ?? null;
    const ids = Array.from(
      new Set([
        ...(selectedId ? [selectedId] : []),
        ...(highlightedPartnerIds ?? highlightedMerchantIds ?? [])
      ])
    );
    map.setFilter(
      HIGHLIGHT_LAYER_ID,
      ids.length > 0
        ? ["in", ["get", "__merchant_id"], ["literal", ids]]
        : ["==", "__merchant_id", "__none__"]
    );
    map.setFilter(
      SELECTED_LAYER_ID,
      selectedId
        ? ["==", ["get", "__merchant_id"], selectedId]
        : ["==", "__merchant_id", "__none__"]
    );
    map.setFilter(
      LAYER_ID,
      selectedId
        ? ["all", ["!", ["has", "point_count"]], ["!=", ["get", "__merchant_id"], selectedId]]
        : ["!", ["has", "point_count"]]
    );
  }, [highlightedMerchantIds, highlightedPartnerIds, selectedMerchantId, selectedPartnerId]);

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
