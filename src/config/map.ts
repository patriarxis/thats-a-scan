/**
 * Atlas API routes live under `/api/atlas/*` so they never shadow Payload's own
 * REST handler at `/api/[...slug]` — a static segment always wins over the
 * catch-all, which silently breaks admin bulk actions on that collection.
 */
export const ATLAS_TEXTURES_API_PATH = "/api/atlas/textures";
export const ATLAS_SEARCH_API_PATH = "/api/atlas/search";
export const ATLAS_DOWNLOAD_API_PATH = "/api/atlas/download";

export const MAP_MAX_LAT_SPAN = 1.2;
export const MAP_MAX_LNG_SPAN = 1.4;
export const MAP_MIN_ZOOM = 8;
export const MAP_DEFAULT_ZOOM = 12;
export const INITIAL_FOCUS_ZOOM = 16;
export const COPIED_FEEDBACK_DURATION_MS = 1200;

/** Matches MapView ATHENS_MAX_BOUNDS — catalog coverage area */
export const ATHENS_CATALOG_BOUNDS = {
  west: 23.38,
  east: 24.1,
  south: 37.8,
  north: 38.14,
} as const;

export function isWithinAthensCatalog(lat: number, lng: number): boolean {
  return (
    lng >= ATHENS_CATALOG_BOUNDS.west &&
    lng <= ATHENS_CATALOG_BOUNDS.east &&
    lat >= ATHENS_CATALOG_BOUNDS.south &&
    lat <= ATHENS_CATALOG_BOUNDS.north
  );
}
