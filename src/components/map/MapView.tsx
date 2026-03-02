"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getMerchantId, type MerchantFeature } from "@/types/merchant";
import { useUserLocation, useViewportStoreQuery } from "@/components/map/hooks";

const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
const ATHENS_INITIAL_ZOOM = 11;
const GREECE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [18.85, 34.24],
  [28.75, 42.16]
];
const SOURCE_ID = "merchants-source";
const LAYER_ID = "merchants-pins";
const CLUSTER_LAYER_ID = "merchants-clusters";
const CLUSTER_COUNT_LAYER_ID = "merchants-cluster-count";
const HIGHLIGHT_LAYER_ID = "merchants-highlight";
const PIN_ICON_ID = "merchant-pin";
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
  selectedMerchantId: string | null;
  highlightedMerchantIds: string[];
  zoomInMessage: string;
  onVisibleMerchantsChange: (payload: {
    merchants: MerchantFeature[];
    loading: boolean;
    updating: boolean;
  }) => void;
  onMerchantSelect: (merchant: MerchantFeature) => void;
};

export type MapViewHandle = {
  flyTo: (center: [number, number], zoom?: number) => void;
};

function withClientIds(features: MerchantFeature[]): MerchantFeature[] {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      __merchant_id: getMerchantId(feature)
    }
  }));
}

function ensurePinIcon(map: MapboxMap) {
  if (map.hasImage(PIN_ICON_ID)) return;
  const size = 44;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#8f499c";
  ctx.beginPath();
  ctx.arc(size / 2, 15, 11, Math.PI, 0);
  ctx.quadraticCurveTo(size - 11, 25, size / 2, size - 5);
  ctx.quadraticCurveTo(11, 25, 11, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, 15, 4.5, 0, Math.PI * 2);
  ctx.fill();
  map.addImage(PIN_ICON_ID, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
}

function ensureMapLayers(map: MapboxMap) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 52
    });
  }

  ensurePinIcon(map);
  const iconId = map.hasImage("marker-15") ? "marker-15" : PIN_ICON_ID;

  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "rgba(143,73,156,0.30)",
          20,
          "rgba(143,73,156,0.45)",
          80,
          "rgba(143,73,156,0.70)"
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 20, 28, 80, 35],
        "circle-stroke-color": "rgba(15,23,42,0.85)",
        "circle-stroke-width": 2
      }
    });
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

  if (!map.getLayer(HIGHLIGHT_LAYER_ID)) {
    map.addLayer({
      id: HIGHLIGHT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", "__merchant_id", "__none__"],
      paint: {
        "circle-radius": 14,
        "circle-color": "rgba(143,73,156,0.18)",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#8f499c"
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
        "icon-image": iconId,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.62, 12, 0.72, 15, 0.86],
        "icon-allow-overlap": true,
        "icon-anchor": "bottom"
      },
      paint: { "icon-color": "#8f499c" }
    });
  }
}

function resolveMapStyle(hasToken: boolean) {
  return hasToken ? MAPBOX_DARK_STYLE_URL : CARTO_DARK_STYLE;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    className,
    selectedMerchantId,
    highlightedMerchantIds,
    zoomInMessage,
    onVisibleMerchantsChange,
    onMerchantSelect
  },
  ref
) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const merchantsRef = useRef<MerchantFeature[]>([]);
  const onVisibleMerchantsChangeRef = useRef(onVisibleMerchantsChange);
  const onMerchantSelectRef = useRef(onMerchantSelect);
  const [mapReady, setMapReady] = useState(false);
  const userLocation = useUserLocation();
  const { merchants, loading, updating, viewportTooWide } = useViewportStoreQuery(
    mapRef,
    userLocation,
    mapReady
  );

  useEffect(() => {
    onVisibleMerchantsChangeRef.current = onVisibleMerchantsChange;
  }, [onVisibleMerchantsChange]);

  useEffect(() => {
    onMerchantSelectRef.current = onMerchantSelect;
  }, [onMerchantSelect]);

  useEffect(() => {
    merchantsRef.current = merchants;
  }, [merchants]);

  const pushDataToMap = (items: MerchantFeature[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: withClientIds(items)
    } as GeoJSON.FeatureCollection);
  };

  useImperativeHandle(ref, () => ({
    flyTo(center, zoom = 14) {
      mapRef.current?.easeTo({ center, zoom, duration: 700 });
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

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false
      }),
      "top-right"
    );

    map.on("load", () => {
      map.setMaxBounds(GREECE_MAX_BOUNDS);
      const minZoomForGreece = map.cameraForBounds(GREECE_MAX_BOUNDS, { padding: 24 })?.zoom;
      if (typeof minZoomForGreece === "number") map.setMinZoom(minZoomForGreece);
      ensureMapLayers(map);
    });

    map.on("mouseenter", LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseenter", CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_ID, () => {
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
      const merchant = merchantsRef.current.find((item) => getMerchantId(item) === merchantId);
      if (merchant) onMerchantSelectRef.current(merchant);
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
    if (!map || !map.isStyleLoaded()) return;
    ensureMapLayers(map);
    pushDataToMap(viewportTooWide ? [] : merchants);
    onVisibleMerchantsChangeRef.current({
      merchants: viewportTooWide ? [] : merchants,
      loading,
      updating
    });
  }, [loading, merchants, updating, viewportTooWide]);

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
    if (!map || !map.getLayer(HIGHLIGHT_LAYER_ID)) return;
    const ids = Array.from(
      new Set([...(selectedMerchantId ? [selectedMerchantId] : []), ...highlightedMerchantIds])
    );
    map.setFilter(
      HIGHLIGHT_LAYER_ID,
      ids.length > 0
        ? ["in", ["get", "__merchant_id"], ["literal", ids]]
        : ["==", "__merchant_id", "__none__"]
    );
  }, [highlightedMerchantIds, selectedMerchantId]);

  return (
    <div className="relative h-full w-full">
      {viewportTooWide && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {zoomInMessage}
        </div>
      )}
      <div ref={mapContainerRef} className={className ?? "h-full w-full"} />
    </div>
  );
});
