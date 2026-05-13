import { NextResponse } from "next/server";
import { fetchAllVenues } from "@/lib/nyamie";
import type { PartnerFeature } from "@/types";
import {
  fetchAllUpHellasFeatures,
  payloadToBounds,
  type BBoxPayload,
  type UpHellasFetchResult,
} from "@/lib/upHellasMerchants";

const DEFAULT_ATHENS_BBOX: BBoxPayload = {
  north_west: { latitude: 38.2, longitude: 23.45 },
  south_east: { latitude: 37.85, longitude: 23.95 }
};

function isValidLatitude(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

function isValidLongitude(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
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
        south_east: { latitude: seLat, longitude: seLng }
      };
    }
  } catch {
    bounds = DEFAULT_ATHENS_BBOX;
  }

  try {
    const [upHellasResult, nyamieAllFeatures] = await Promise.all([
      fetchAllUpHellasFeatures(payloadToBounds(bounds)).catch((err) => {
        console.error("Failed to fetch from Up Hellas:", err);
        return {
          features: [],
          requestCount: 0,
          saturatedBoundsCount: 0,
          stoppedByRequestLimit: false,
          complete: false,
        } satisfies UpHellasFetchResult;
      }),
      fetchAllVenues().catch((err) => {
        console.error("Failed to fetch from Nyamie:", err);
        return [];
      })
    ]);

    const filteredNyamie = nyamieAllFeatures
      .filter((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const { north_west, south_east } = bounds;

        return (
          lat <= north_west.latitude &&
          lat >= south_east.latitude &&
          lng >= north_west.longitude &&
          lng <= south_east.longitude
        );
      })
      .map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          __source: "nyamie",
        },
      }));

    return NextResponse.json({
      type: "FeatureCollection",
      features: [...upHellasResult.features, ...filteredNyamie],
      meta: {
        upHellas: {
          requestCount: upHellasResult.requestCount,
          saturatedBoundsCount: upHellasResult.saturatedBoundsCount,
          stoppedByRequestLimit: upHellasResult.stoppedByRequestLimit,
          complete: upHellasResult.complete,
        },
      },
    });
  } catch (error) {
    console.error("Error merging merchant data sources:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching venues" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with map bounds payload." },
    { status: 405 }
  );
}


