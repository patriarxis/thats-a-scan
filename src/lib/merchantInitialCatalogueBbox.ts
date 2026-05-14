import type { BBoxPayload } from "@/lib/upHellasMerchants";

/** Athens-centred first-fetch box; padded past the default map view so cold loads don’t look like a sharp rectangle before the full catalogue hydrates. */
export const INITIAL_CATALOGUE_BBOX: BBoxPayload = {
  north_west: { latitude: 38.38, longitude: 23.22 },
  south_east: { latitude: 37.68, longitude: 24.12 },
};
