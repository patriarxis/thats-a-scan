import { NextResponse } from "next/server";
import {
  getCachedMerchantCatalogue,
  type MerchantCatalogueSnapshot,
} from "@/lib/merchantCatalogueCache";
import type { PartnerFeature } from "@/types";
import type { BBoxPayload } from "@/lib/upHellasMerchants";

const DEFAULT_ATHENS_BBOX: BBoxPayload = {
  north_west: { latitude: 38.2, longitude: 23.45 },
  south_east: { latitude: 37.85, longitude: 23.95 },
};

const CACHE_CONTROL_HEADER =
  "public, s-maxage=600, stale-while-revalidate=3600";

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

function buildMeta(snapshot: MerchantCatalogueSnapshot) {
  return {
    upHellas: {
      requestCount: snapshot.upHellas.requestCount,
      saturatedBoundsCount: snapshot.upHellas.saturatedBoundsCount,
      stoppedByRequestLimit: snapshot.upHellas.stoppedByRequestLimit,
      complete: snapshot.upHellas.complete,
    },
    loadedAt: snapshot.loadedAt,
  };
}

function buildFullCollection(snapshot: MerchantCatalogueSnapshot) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...tagSource(snapshot.upHellas.features, "up_hellas"),
      ...tagSource(snapshot.nyamie, "nyamie"),
    ],
    meta: buildMeta(snapshot),
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  try {
    const snapshot = await getCachedMerchantCatalogue();
    if (scope === "all") {
      return jsonWithCacheHeaders(buildFullCollection(snapshot));
    }
    return NextResponse.json(
      { error: "Use ?scope=all for the full catalogue, or POST with bbox." },
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
  let bounds: BBoxPayload = DEFAULT_ATHENS_BBOX;
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
    bounds = DEFAULT_ATHENS_BBOX;
  }

  try {
    const snapshot = await getCachedMerchantCatalogue();
    const upHellasInBox = filterByBounds(snapshot.upHellas.features, bounds);
    const nyamieInBox = filterByBounds(snapshot.nyamie, bounds);

    return jsonWithCacheHeaders({
      type: "FeatureCollection" as const,
      features: [
        ...tagSource(upHellasInBox, "up_hellas"),
        ...tagSource(nyamieInBox, "nyamie"),
      ],
      meta: buildMeta(snapshot),
    });
  } catch (error) {
    console.error("Error merging merchant data sources:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching venues" },
      { status: 500 },
    );
  }
}
