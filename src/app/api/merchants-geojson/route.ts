import { NextResponse } from "next/server";
import {
  getCachedBboxFeatures,
  setCachedBboxFeatures,
} from "@/lib/merchantBboxCache";
import {
  getCachedMerchantCatalogue,
  kickMerchantCatalogueWarm,
  tryGetCachedCompleteSnapshot,
  type MerchantCatalogueSnapshot,
} from "@/lib/merchantCatalogueCache";
import { INITIAL_CATALOGUE_BBOX } from "@/lib/merchantInitialCatalogueBbox";
import {
  fetchAllVenues,
  isNyamieCacheWarm,
  kickNyamieWarm,
} from "@/lib/nyamie";
import type { PartnerFeature } from "@/types";
import {
  fetchUpHellasViewport,
  payloadToBounds,
  type BBoxPayload,
  type UpHellasFetchResult,
} from "@/lib/upHellasMerchants";

const CACHE_CONTROL_HEADER =
  "public, max-age=600, s-maxage=600, stale-while-revalidate=3600";

function isValidLatitude(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

function isValidLongitude(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

function tagSource(features: PartnerFeature[], source: string): PartnerFeature[] {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      __source: source,
    },
  }));
}

function buildMeta(snapshot: MerchantCatalogueSnapshot, cacheHit?: string) {
  return {
    cache: cacheHit ? { hit: cacheHit } : undefined,
    upHellas: {
      requestCount: snapshot.upHellas.requestCount,
      saturatedBoundsCount: snapshot.upHellas.saturatedBoundsCount,
      stoppedByRequestLimit: snapshot.upHellas.stoppedByRequestLimit,
      complete: snapshot.upHellas.complete,
    },
    loadedAt: snapshot.loadedAt,
  };
}

function buildMetaFromViewportFetch(
  up: UpHellasFetchResult,
  loadedAt: number,
  options?: { cacheHit?: string; nyamie?: { included: boolean } },
) {
  return {
    cache: options?.cacheHit ? { hit: options.cacheHit } : undefined,
    nyamie: options?.nyamie,
    upHellas: {
      requestCount: up.requestCount,
      saturatedBoundsCount: up.saturatedBoundsCount,
      stoppedByRequestLimit: up.stoppedByRequestLimit,
      complete: up.complete,
    },
    loadedAt,
  };
}

function buildFullCollection(snapshot: MerchantCatalogueSnapshot) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...tagSource(snapshot.upHellas.features, "up_hellas"),
      ...tagSource(snapshot.nyamie, "nyamie"),
    ],
    meta: buildMeta(snapshot, "catalogue"),
  };
}

function filterByBounds(
  features: PartnerFeature[],
  bbox: BBoxPayload,
): PartnerFeature[] {
  const { north_west, south_east } = bbox;
  return features.filter((feature) => {
    const lng = Number(feature.geometry.coordinates[0]);
    const lat = Number(feature.geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    return (
      lat <= north_west.latitude &&
      lat >= south_east.latitude &&
      lng >= north_west.longitude &&
      lng <= south_east.longitude
    );
  });
}

function jsonWithCacheHeaders(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", CACHE_CONTROL_HEADER);
  return response;
}

async function fetchColdViewportFeatures(bounds: BBoxPayload): Promise<{
  features: PartnerFeature[];
  upResult: UpHellasFetchResult;
  nyamieIncluded: boolean;
}> {
  const upBounds = payloadToBounds(bounds);
  const nyamieWarm = isNyamieCacheWarm();

  let upResult: UpHellasFetchResult;
  let nyamieInBox: PartnerFeature[] = [];

  if (nyamieWarm) {
    const [up, nyamieAll] = await Promise.all([
      fetchUpHellasViewport(upBounds),
      fetchAllVenues().catch((err) => {
        console.error("Nyamie fetch failed on warm cache path:", err);
        return [] as PartnerFeature[];
      }),
    ]);
    upResult = up;
    nyamieInBox = filterByBounds(nyamieAll, bounds);
  } else {
    kickNyamieWarm();
    upResult = await fetchUpHellasViewport(upBounds);
  }

  const features = [
    ...tagSource(upResult.features, "up_hellas"),
    ...tagSource(nyamieInBox, "nyamie"),
  ];

  return {
    features,
    upResult,
    nyamieIncluded: nyamieWarm,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  try {
    if (scope === "warm") {
      kickMerchantCatalogueWarm();
      return jsonWithCacheHeaders({ ok: true, warming: true });
    }

    const snapshot = await getCachedMerchantCatalogue();
    if (scope === "all") {
      return jsonWithCacheHeaders(buildFullCollection(snapshot));
    }
    return NextResponse.json(
      {
        error:
          "Use ?scope=all for the full catalogue, ?scope=warm to pre-warm, or POST with bbox.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error returning merchant catalogue:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching venues" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let bounds: BBoxPayload = INITIAL_CATALOGUE_BBOX;
  try {
    const json = (await request.json()) as Partial<BBoxPayload>;
    const nwLat = Number(json?.north_west?.latitude);
    const nwLng = Number(json?.north_west?.longitude);
    const seLat = Number(json?.south_east?.latitude);
    const seLng = Number(json?.south_east?.longitude);

    if (
      isValidLatitude(nwLat) &&
      isValidLongitude(nwLng) &&
      isValidLatitude(seLat) &&
      isValidLongitude(seLng) &&
      nwLat > seLat
    ) {
      bounds = {
        north_west: { latitude: nwLat, longitude: nwLng },
        south_east: { latitude: seLat, longitude: seLng },
      };
    }
  } catch {
    bounds = INITIAL_CATALOGUE_BBOX;
  }

  try {
    const snapshot = tryGetCachedCompleteSnapshot();
    if (snapshot) {
      const upHellasInBox = filterByBounds(snapshot.upHellas.features, bounds);
      const nyamieInBox = filterByBounds(snapshot.nyamie, bounds);

      return jsonWithCacheHeaders({
        type: "FeatureCollection" as const,
        features: [
          ...tagSource(upHellasInBox, "up_hellas"),
          ...tagSource(nyamieInBox, "nyamie"),
        ],
        meta: buildMeta(snapshot, "catalogue"),
      });
    }

    const lruHit = getCachedBboxFeatures(bounds);
    if (lruHit) {
      return jsonWithCacheHeaders({
        type: "FeatureCollection" as const,
        features: lruHit,
        meta: buildMetaFromViewportFetch(
          {
            features: [],
            requestCount: 0,
            saturatedBoundsCount: 0,
            stoppedByRequestLimit: false,
            complete: true,
          },
          Date.now(),
          { cacheHit: "bbox-lru", nyamie: { included: true } },
        ),
      });
    }

    const { features, upResult, nyamieIncluded } =
      await fetchColdViewportFeatures(bounds);
    setCachedBboxFeatures(bounds, features);
    const loadedAt = Date.now();

    return jsonWithCacheHeaders({
      type: "FeatureCollection" as const,
      features,
      meta: buildMetaFromViewportFetch(upResult, loadedAt, {
        cacheHit: "upstream",
        nyamie: { included: nyamieIncluded },
      }),
    });
  } catch (error) {
    console.error("Error merging merchant data sources:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching venues" },
      { status: 500 },
    );
  }
}
