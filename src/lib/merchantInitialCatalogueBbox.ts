import type { BBoxPayload } from "@/lib/upHellasMerchants";
import { defaultInitialCatalogueBbox } from "@/lib/merchantViewportTiles";

/** Server fallback when POST body is missing or invalid (small Athens neighbourhood). */
export const INITIAL_CATALOGUE_BBOX: BBoxPayload = defaultInitialCatalogueBbox();
