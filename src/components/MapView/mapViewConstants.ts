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

export const DETAILED_MARKER_MIN_ZOOM = 12;
export const SHOW_ALL_MARKERS_ZOOM = 14;
export const ACTIVE_PIN_QUICK_ZOOM = 15;

/** Zoom is rounded to nearest half-level for marker decluttering to avoid jitter while pinching. */
export const DECLUTTER_ZOOM_QUANTUM = 0.5;

/**
 * Declutter delay at wide zoom. At zoom ≥ 14, `declutterDebounceMsForZoom` in `mapViewport.ts`
 * uses 0ms so pins refresh immediately after the viewport store updates.
 */
export const DECLUTTER_VIEWPORT_DEBOUNCE_MS = 250;

/** Single source of truth for per-zoom pin caps, spatial grid, and icon/dot mix. */
export type DeclutterProfile = {
  minZoom: number;
  maxVisible: number;
  /** When null, the sticky geo grid is skipped (street mode). */
  cellSizePx: number | null;
  maxPerCell: number;
  /** Fraction of `maxVisible` that render as full brand icons; the rest are orange dots. */
  iconShare: number;
  /**
   * Street mode only: extra merchants beyond `maxVisible` that still render as dots
   * (instead of being fully hidden by the cap).
   */
  maxDotOverflow?: number;
};

export const DECLUTTER_PROFILE_BY_ZOOM: DeclutterProfile[] = [
  { minZoom: 0, maxVisible: 4000, cellSizePx: 56, maxPerCell: 4, iconShare: 0.2 },
  { minZoom: 8, maxVisible: 5500, cellSizePx: 48, maxPerCell: 5, iconShare: 0.2 },
  { minZoom: 10, maxVisible: 7000, cellSizePx: 40, maxPerCell: 6, iconShare: 0.35 },
  { minZoom: 12, maxVisible: 9000, cellSizePx: 32, maxPerCell: 8, iconShare: 0.5 },
  { minZoom: 13, maxVisible: 9000, cellSizePx: 26, maxPerCell: 10, iconShare: 0.75 },
  {
    minZoom: 14,
    maxVisible: 3200,
    cellSizePx: null,
    maxPerCell: 0,
    iconShare: 0.38,
    maxDotOverflow: 1800,
  },
];

export const declutterProfileForZoom = (zoom: number): DeclutterProfile => {
  let profile = DECLUTTER_PROFILE_BY_ZOOM[0]!;
  for (const step of DECLUTTER_PROFILE_BY_ZOOM) {
    if (zoom >= step.minZoom) profile = step;
  }
  return profile;
};

export const usesGeoGridForZoom = (zoom: number): boolean =>
  declutterProfileForZoom(zoom).cellSizePx !== null;

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
