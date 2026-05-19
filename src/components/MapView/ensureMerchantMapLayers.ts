import type { Map as MapboxMap } from "mapbox-gl";
import type { PartnerFeature } from "@/types";
import {
  DETAILED_MARKER_MIN_ZOOM,
  DOT_LAYER_ID,
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

  ensureMarkerIcons(map, partnersForIcons);

  const markerIconOpacity: ["coalesce", ["get", string], number] = [
    "coalesce",
    ["get", "__marker_fade"],
    1,
  ];
  const markerFade = ["coalesce", ["get", "__marker_fade"], 1] as ["coalesce", ["get", string], number];
  const dotCircleOpacity: [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...Array<number | ["*", ["coalesce", ["get", string], number], number]>,
  ] = [
    "interpolate",
    ["linear"],
    ["zoom"],
    12,
    ["*", markerFade, 0.92],
    14,
    ["*", markerFade, 0.88],
    16,
    ["*", markerFade, 0.82],
  ];

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
      paint: {
        "icon-opacity": markerIconOpacity,
      },
    });
  } else {
    map.setPaintProperty(LAYER_ID, "icon-opacity", markerIconOpacity);
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 8, 2.6, 11.5, 3.3, 14, 3.2, 16, 3.6],
        "circle-stroke-color": "rgba(15,23,42,0.7)",
        "circle-stroke-width": 0.8,
        "circle-opacity": dotCircleOpacity,
      },
    });
  } else {
    map.setPaintProperty(DOT_LAYER_ID, "circle-opacity", dotCircleOpacity);
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
      paint: {
        "icon-opacity": markerIconOpacity,
      },
    });
  } else {
    map.setPaintProperty(SELECTED_LAYER_ID, "icon-opacity", markerIconOpacity);
  }

};
