import type { StyleSpecification } from "mapbox-gl";

export const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
export const ATHENS_INITIAL_ZOOM = 11;
export const GREECE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [18.85, 34.24],
  [28.75, 42.16],
];

export const SOURCE_ID = "merchants-source";
export const PREVIEW_SOURCE_ID = "merchants-preview-source";
export const LAYER_ID = "merchants-markers";
export const DOT_LAYER_ID = "merchants-markers-dots";
export const SELECTED_LAYER_ID = "merchants-markers-selected";

export const MARKER_ICON_MEAL_ID = "merchant-marker-meal";
export const MARKER_ICON_REWARDS_ID = "merchant-marker-rewards";
export const MARKER_ICON_GYMS_ID = "merchant-marker-gyms";
export const MARKER_ICON_DEFAULT_ID = MARKER_ICON_REWARDS_ID;

export const DETAILED_MARKER_MIN_ZOOM = 13;
export const SHOW_ALL_MARKERS_ZOOM = 16;
export const ACTIVE_PIN_QUICK_ZOOM = 16;

/** Zoom is rounded to nearest half-level for marker decluttering to avoid jitter while pinching. */
export const DECLUTTER_ZOOM_QUANTUM = 0.5;

/**
 * Declutter delay at wide zoom. At zoom ≥ 14, `declutterDebounceMsForZoom` in `mapViewport.ts`
 * uses 0ms so pins refresh immediately after the viewport store updates.
 */
export const DECLUTTER_VIEWPORT_DEBOUNCE_MS = 250;

export const ZOOM_REVEAL_STEPS: Array<{ minZoom: number; maxCount: number }> = [
  { minZoom: 0, maxCount: 2000 },
  { minZoom: 8, maxCount: 2500 },
  { minZoom: 10, maxCount: 3000 },
  { minZoom: 12, maxCount: 3500 },
  { minZoom: 14, maxCount: 4500 },
];

export const MARKER_DENSITY_STEPS: Array<{
  minZoom: number;
  cellSizePx: number;
  maxPerCell: number;
}> = [
  { minZoom: 0, cellSizePx: 72, maxPerCell: 2 },
  { minZoom: 8, cellSizePx: 60, maxPerCell: 2 },
  { minZoom: 10, cellSizePx: 52, maxPerCell: 2 },
  { minZoom: 12, cellSizePx: 44, maxPerCell: 2 },
  { minZoom: 14, cellSizePx: 38, maxPerCell: 3 },
  { minZoom: 15, cellSizePx: 30, maxPerCell: 4 },
];

export const MAPBOX_DARK_STYLE_URL = "mapbox://styles/mapbox/dark-v11";

export const CARTO_DARK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    cartoDark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "carto-dark", type: "raster", source: "cartoDark" }],
};
