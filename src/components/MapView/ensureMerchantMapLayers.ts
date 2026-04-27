import type { Map as MapboxMap } from "mapbox-gl";
import type { PartnerFeature } from "@/types";
import {
  DETAILED_MARKER_MIN_ZOOM,
  DOT_LAYER_ID,
  HEATMAP_LAYER_ID,
  HEATMAP_SOURCE_ID,
  HIGHLIGHT_LAYER_ID,
  LAYER_ID,
  MARKER_ICON_DEFAULT_ID,
  PREVIEW_SOURCE_ID,
  SELECTED_LAYER_ID,
  SHOW_ALL_MARKERS_ZOOM,
  SOURCE_ID,
} from "./mapViewConstants";
import { ensureMarkerIcons } from "./merchantMarkerCanvas";

export const ensureMerchantMapLayers = (map: MapboxMap, partnersForIcons: PartnerFeature[] = []) => {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource(PREVIEW_SOURCE_ID)) {
    map.addSource(PREVIEW_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource(HEATMAP_SOURCE_ID)) {
    map.addSource(HEATMAP_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      buffer: 0,
    });
  }

  ensureMarkerIcons(map, partnersForIcons);

  if (!map.getLayer(HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: HEATMAP_LAYER_ID,
      type: "heatmap",
      source: HEATMAP_SOURCE_ID,
      maxzoom: 12,
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
          1,
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
          1.4,
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          window.innerWidth > 1024 ? 25 : 15,
          8,
          window.innerWidth > 1024 ? 40 : 25,
          12,
          window.innerWidth > 1024 ? 60 : 40,
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
          0.22,
          12,
          0,
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
          "rgba(255, 255, 255, 0.8)",
        ],
      },
    });
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
        "circle-stroke-color": "rgba(226,232,240,0.65)",
      },
    });
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      minzoom: DETAILED_MARKER_MIN_ZOOM,
      filter: ["==", ["get", "__marker_state"], "default"],
      layout: {
        "icon-image": ["coalesce", ["get", "__marker_icon"], MARKER_ICON_DEFAULT_ID],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.92, 12, 1, 15, 1.08],
        "icon-allow-overlap": ["step", ["zoom"], false, SHOW_ALL_MARKERS_ZOOM, true],
        "icon-ignore-placement": ["step", ["zoom"], false, SHOW_ALL_MARKERS_ZOOM, true],
        "icon-anchor": "center",
      },
    });
  }

  if (!map.getLayer(DOT_LAYER_ID)) {
    map.addLayer({
      id: DOT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: 0,
      filter: ["==", ["get", "__marker_state"], "small"],
      paint: {
        "circle-color": ["coalesce", ["get", "__marker_dot_color"], "#f59100"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 8, 2.6, 11.5, 3.3, 14, 3.8, 16, 4.2],
        "circle-stroke-color": "rgba(15,23,42,0.7)",
        "circle-stroke-width": 0.8,
      },
    });
  }

  if (!map.getLayer(SELECTED_LAYER_ID)) {
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["==", "__merchant_id", "__none__"],
      layout: {
        "icon-image": ["coalesce", ["get", "__marker_icon_active"], MARKER_ICON_DEFAULT_ID],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.92, 12, 1, 15, 1.08],
        "icon-offset": [0, 0],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-anchor": "center",
      },
    });
  }

  if (map.getLayer(HIGHLIGHT_LAYER_ID) && map.getLayer(SELECTED_LAYER_ID)) {
    map.moveLayer(HIGHLIGHT_LAYER_ID, SELECTED_LAYER_ID);
  }
};
