import type { BBoxPayload } from "@/lib/upHellasMerchants";

/** Athens-area box aligned with the map’s default center/zoom; used for first merchant POST. */
export const INITIAL_CATALOGUE_BBOX: BBoxPayload = {
  north_west: { latitude: 38.2, longitude: 23.45 },
  south_east: { latitude: 37.85, longitude: 23.95 },
};
