import type { LngLatBounds, Map as MapboxMap } from "mapbox-gl";

/** Align with `mapViewConstants` — minimum zoom for throttled pan updates. */
export const MAP_MOVE_UPDATE_MIN_ZOOM = 13;

/** Zoom at which viewport / declutter updates run with minimal delay. */
export const MAP_FAST_UPDATE_MIN_ZOOM = 14;

export const MAP_MOVE_THROTTLE_MS = 100;

const MOVE_DEBOUNCE_WIDE_MS = 200;
const MOVE_DEBOUNCE_FAST_MS = 0;

const DECLUTTER_DEBOUNCE_WIDE_MS = 250;
const DECLUTTER_DEBOUNCE_FAST_MS = 0;

const VIEWPORT_BUFFER_STEPS: Array<{ minZoom: number; fraction: number }> = [
  { minZoom: 0, fraction: 0.25 },
  { minZoom: 11, fraction: 0.45 },
  { minZoom: 13, fraction: 0.65 },
  { minZoom: 14, fraction: 0.75 },
];

export type MapBoundsBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export const viewportBufferFractionForZoom = (zoom: number): number => {
  let fraction = VIEWPORT_BUFFER_STEPS[0]!.fraction;
  for (const step of VIEWPORT_BUFFER_STEPS) {
    if (zoom >= step.minZoom) fraction = step.fraction;
  }
  return fraction;
};

export const boundsBoxFromLngLatBounds = (bounds: LngLatBounds): MapBoundsBox => ({
  north: bounds.getNorth(),
  south: bounds.getSouth(),
  east: bounds.getEast(),
  west: bounds.getWest(),
});

export const expandBoundsBox = (box: MapBoundsBox, fraction: number): MapBoundsBox => {
  if (fraction <= 0) return box;
  const latSpan = Math.abs(box.north - box.south);
  const lngSpan = Math.abs(box.east - box.west);
  const latPad = latSpan * fraction;
  const lngPad = lngSpan * fraction;
  return {
    north: box.north + latPad,
    south: box.south - latPad,
    east: box.east + lngPad,
    west: box.west - lngPad,
  };
};

export const pointInBoundsBox = (lng: number, lat: number, box: MapBoundsBox): boolean =>
  lat <= box.north && lat >= box.south && lng >= box.west && lng <= box.east;

export const getBufferedBoundsBox = (
  map: MapboxMap,
  zoom: number = map.getZoom(),
): MapBoundsBox | null => {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const fraction = viewportBufferFractionForZoom(zoom);
  return expandBoundsBox(boundsBoxFromLngLatBounds(bounds), fraction);
};

export const moveDebounceMsForZoom = (zoom: number): number =>
  zoom >= MAP_FAST_UPDATE_MIN_ZOOM ? MOVE_DEBOUNCE_FAST_MS : MOVE_DEBOUNCE_WIDE_MS;

export const declutterDebounceMsForZoom = (zoom: number): number =>
  zoom >= MAP_FAST_UPDATE_MIN_ZOOM ? DECLUTTER_DEBOUNCE_FAST_MS : DECLUTTER_DEBOUNCE_WIDE_MS;

export const shouldUpdateViewportOnMove = (zoom: number): boolean =>
  zoom >= MAP_MOVE_UPDATE_MIN_ZOOM;

export const mapCenter = (map: MapboxMap): { lat: number; lng: number } | null => {
  const center = map.getCenter();
  if (!center) return null;
  return { lat: center.lat, lng: center.lng };
};

export const movementBetweenCenters = (
  prev: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
): { dLat: number; dLng: number } | null => {
  if (!prev) return null;
  const dLat = next.lat - prev.lat;
  const dLng = next.lng - prev.lng;
  if (Math.abs(dLat) < 1e-8 && Math.abs(dLng) < 1e-8) return null;
  return { dLat, dLng };
};

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const run = () => {
    timer = null;
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  const throttled = (...args: Args) => {
    lastArgs = args;
    if (timer === null) {
      timer = setTimeout(run, ms);
    }
  };

  throttled.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return throttled;
}
