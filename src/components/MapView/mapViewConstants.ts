import type { StyleSpecification } from "maplibre-gl";

export const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
export { MAP_DEFAULT_ZOOM as ATHENS_INITIAL_ZOOM, MAP_MIN_ZOOM, INITIAL_FOCUS_ZOOM } from "@/config/map";

/** Greater Athens metro — Piraeus, northern suburbs, eastern hills */
export const ATHENS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [23.38, 37.80],
  [24.10, 38.14],
];

export const SOURCE_ID = "textures-source";
export const PREVIEW_SOURCE_ID = "textures-preview-source";
export const SEARCH_SOURCE_ID = "textures-search-source";
export const LAYER_ID = "textures-markers";
export const DOT_LAYER_ID = "textures-markers-dots";
export const SEARCH_DOTS_LAYER_ID = "textures-search-dots";
export const SELECTED_LAYER_ID = "textures-markers-selected";

export const MARKER_ICON_DEFAULT_ID = "texture-marker-default";

export const DETAILED_MARKER_MIN_ZOOM = 12;
export const SHOW_ALL_MARKERS_ZOOM = 16;
export const ACTIVE_PIN_QUICK_ZOOM = 15;

export const DECLUTTER_ZOOM_QUANTUM = 0.5;
export const DECLUTTER_VIEWPORT_DEBOUNCE_MS = 250;
export const MARKER_FADE_DURATION_MS = 220;

export type DeclutterProfile = {
  minZoom: number;
  maxVisible: number;
  cellSizePx: number | null;
  maxPerCell: number;
  iconShare: number;
  maxDotOverflow?: number;
};

export const DECLUTTER_PROFILE_BY_ZOOM: DeclutterProfile[] = [
  { minZoom: 0, maxVisible: 200, cellSizePx: 52, maxPerCell: 4, iconShare: 0.5 },
  { minZoom: 12, maxVisible: 400, cellSizePx: 30, maxPerCell: 6, iconShare: 0.6 },
  { minZoom: 14, maxVisible: 600, cellSizePx: 28, maxPerCell: 3, iconShare: 0.7 },
  { minZoom: 16, maxVisible: 800, cellSizePx: 18, maxPerCell: 3, iconShare: 0.8, maxDotOverflow: 100 },
  { minZoom: 17, maxVisible: 1000, cellSizePx: null, maxPerCell: 0, iconShare: 0.9, maxDotOverflow: 200 },
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
    if (lower.cellSizePx !== null && upper.cellSizePx === null) return t >= 0.88 ? null : lower.cellSizePx;
    if (lower.cellSizePx === null && upper.cellSizePx !== null) return upper.cellSizePx;
    return Math.round(lower.cellSizePx! + (upper.cellSizePx! - lower.cellSizePx!) * t);
  })();
  return {
    minZoom: lower.minZoom,
    maxVisible: Math.round(lower.maxVisible + (upper.maxVisible - lower.maxVisible) * t),
    cellSizePx,
    maxPerCell: Math.round(lower.maxPerCell + (upper.maxPerCell - lower.maxPerCell) * t),
    iconShare: lower.iconShare + (upper.iconShare - lower.iconShare) * t,
  };
};

export const usesGeoGridForZoom = (zoom: number): boolean =>
  declutterProfileForZoom(zoom).cellSizePx !== null;

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

/** Legacy raster fallback — prefer resolveMapStyle() vector palette */
export const ARCHIVE_FIELD_MAP_STYLE = CARTO_DARK_STYLE;
