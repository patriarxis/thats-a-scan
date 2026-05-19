import type { StyleSpecification } from "mapbox-gl";

export const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
export { INITIAL_FOCUS_ZOOM as ATHENS_INITIAL_ZOOM } from "@/lib/config";
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
/** Below this zoom, Mapbox collision hides overlapping brand icons (pairs with declutter grid). */
export const SHOW_ALL_MARKERS_ZOOM = 16;
export const ACTIVE_PIN_QUICK_ZOOM = 15;

/** Zoom is rounded to nearest half-level for marker decluttering to avoid jitter while pinching. */
export const DECLUTTER_ZOOM_QUANTUM = 0.5;

/**
 * Declutter delay at wide zoom. At zoom ≥ 14, `declutterDebounceMsForZoom` in `mapViewport.ts`
 * uses 0ms so pins refresh immediately after the viewport store updates.
 */
export const DECLUTTER_VIEWPORT_DEBOUNCE_MS = 250;

/** Pin opacity transition when declutter shows or hides a merchant. */
export const MARKER_FADE_DURATION_MS = 220;

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
  { minZoom: 0, maxVisible: 1400, cellSizePx: 52, maxPerCell: 4, iconShare: 0.22 },
  { minZoom: 8, maxVisible: 1800, cellSizePx: 44, maxPerCell: 5, iconShare: 0.24 },
  { minZoom: 10, maxVisible: 2200, cellSizePx: 36, maxPerCell: 5, iconShare: 0.3 },
  { minZoom: 12, maxVisible: 2600, cellSizePx: 30, maxPerCell: 6, iconShare: 0.38 },
  { minZoom: 13, maxVisible: 2800, cellSizePx: 26, maxPerCell: 6, iconShare: 0.4 },
  {
    minZoom: 14,
    maxVisible: 2400,
    cellSizePx: 28,
    maxPerCell: 3,
    iconShare: 0.36,
  },
  {
    minZoom: 15,
    maxVisible: 2600,
    cellSizePx: 22,
    maxPerCell: 3,
    iconShare: 0.4,
  },
  {
    minZoom: 16,
    maxVisible: 2200,
    cellSizePx: 18,
    maxPerCell: 3,
    iconShare: 0.42,
    maxDotOverflow: 500,
  },
  {
    minZoom: 17,
    maxVisible: 3200,
    cellSizePx: null,
    maxPerCell: 0,
    iconShare: 0.45,
    maxDotOverflow: 800,
  },
];

export const declutterProfileForZoom = (zoom: number): DeclutterProfile => {
  const steps = DECLUTTER_PROFILE_BY_ZOOM;
  const z = zoom;

  if (z <= steps[0]!.minZoom) return { ...steps[0]! };
  const last = steps[steps.length - 1]!;
  if (z >= last.minZoom) return { ...last };

  let lower = steps[0]!;
  let upper = steps[1]!;
  for (let i = 0; i < steps.length - 1; i += 1) {
    if (z >= steps[i]!.minZoom && z < steps[i + 1]!.minZoom) {
      lower = steps[i]!;
      upper = steps[i + 1]!;
      break;
    }
  }

  const span = upper.minZoom - lower.minZoom;
  const t = span > 0 ? (z - lower.minZoom) / span : 0;

  const cellSizePx = (() => {
    if (lower.cellSizePx === null && upper.cellSizePx === null) return null;
    if (lower.cellSizePx !== null && upper.cellSizePx === null) {
      return t >= 0.88 ? null : lower.cellSizePx;
    }
    if (lower.cellSizePx === null && upper.cellSizePx !== null) {
      return upper.cellSizePx;
    }
    return Math.round(lower.cellSizePx! + (upper.cellSizePx! - lower.cellSizePx!) * t);
  })();

  const lowerOverflow = lower.maxDotOverflow ?? 0;
  const upperOverflow = upper.maxDotOverflow ?? lowerOverflow;
  const maxDotOverflow =
    lower.maxDotOverflow !== undefined || upper.maxDotOverflow !== undefined
      ? Math.round(lowerOverflow + (upperOverflow - lowerOverflow) * t)
      : undefined;

  return {
    minZoom: lower.minZoom,
    maxVisible: Math.round(lower.maxVisible + (upper.maxVisible - lower.maxVisible) * t),
    cellSizePx,
    maxPerCell: Math.round(lower.maxPerCell + (upper.maxPerCell - lower.maxPerCell) * t),
    iconShare: lower.iconShare + (upper.iconShare - lower.iconShare) * t,
    ...(maxDotOverflow !== undefined && maxDotOverflow > 0 ? { maxDotOverflow } : {}),
  };
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
