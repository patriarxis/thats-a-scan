// Search & suggestions
/** @deprecated Use SEARCH_SUGGESTIONS_DEBOUNCE_MS */
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_SUGGESTIONS_DEBOUNCE_MS = 300;
export const SEARCH_MAP_DEBOUNCE_MS = 500;
export const SEARCH_SUGGESTION_LIMIT = 10;
export const MERCHANT_SUGGESTION_LIMIT = 10;
/** Max nationwide search pins rendered on the map. */
export const MAP_SEARCH_MAX_FEATURES = 2500;
export const SEARCH_MAP_MIN_QUERY_LENGTH = 2;
export const GEOCODING_RESULT_LIMIT = 6;
export const GEOCODING_MIN_QUERY_LENGTH = 2;
export const GEOCODING_FETCH_TIMEOUT_MS = 5000;

// Map viewport constraints
export const MAP_MAX_LAT_SPAN = 0.6;
export const MAP_MAX_LNG_SPAN = 0.9;

/** Zoom for first camera position and first merchant bbox (street-level). */
export const INITIAL_FOCUS_ZOOM = 17;

export const BASE_TILE_DEG = 0.08;
export const MAX_CONCURRENT_FETCHES = 3;
export const MAX_FETCHES_PER_TRIGGER_LOW_ZOOM = 4;
export const MAX_FETCHES_PER_TRIGGER_HIGH_ZOOM = 6;
export const FETCH_ZOOM_THRESHOLD = 14;
/** Below this zoom, show overview sample + focus detail (no tile grid storm). */
export const MIN_ZOOM_FOR_VIEWPORT_FETCH = 12;
/** At/above this zoom, viewport data is detail-only (no overview downsampling). */
export const OVERVIEW_BLEND_ZOOM_START = 14;
/** At/below this zoom, full national overview sampling applies. */
export const OVERVIEW_BLEND_ZOOM_END = 10;
/** Use one capped bbox instead of a tile grid when the view covers more cells than this. */
export const MAX_TILES_FOR_GRID_FETCH = 20;
export const MAX_TILES_FOR_BACKFILL = 36;
export const PREFETCH_MOVE_THROTTLE_MS = 350;

/** Delay after the first street-level viewport load before the national overview sample. */
export const OVERVIEW_FETCH_DELAY_MS = 2500;
/** Max pins shown when zoomed out (Mapbox declutter further shapes hotspots). */
export const OVERVIEW_MAX_DISPLAY_FEATURES = 1500;
/** Grid cell size (degrees) for national overview downsampling (~13 km). */
export const OVERVIEW_GRID_DECIMALS = 0.12;
/** Hard cap on features sent to Mapbox declutter per frame. */
export const MAX_MERCHANTS_FOR_MAP_RENDER = 3500;
/** Max automatic follow-up fetch rounds after a pan (prevents runaway loops). */
export const MAX_VIEWPORT_FETCH_CONTINUE_ROUNDS = 4;

// UI feedback timers (ms)
export const COPIED_FEEDBACK_DURATION_MS = 1200;

// Virtualized list
export const STORE_LIST_ROW_HEIGHT = 116;
export const SKELETON_ITEM_COUNT = 6;
