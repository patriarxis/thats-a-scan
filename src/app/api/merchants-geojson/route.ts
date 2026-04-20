import { NextResponse } from "next/server";
import { fetchAllVenues } from "@/lib/nyamie";

const UP_HELLAS_API_URL = "https://merchants-map.uphellas.gr/geojson/search";

type BBoxPayload = {
  north_west: {
    latitude: number;
    longitude: number;
  };
  south_east: {
    latitude: number;
    longitude: number;
  };
};

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
    // Fetch from both sources in parallel
    const [upHellasRes, nyamieAllFeatures] = await Promise.all([
      fetch(UP_HELLAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bounds),
        next: { revalidate: 60 }
      }).catch((err) => {
        console.error("Failed to fetch from Up Hellas:", err);
        return null;
      }),
      fetchAllVenues().catch((err) => {
        console.error("Failed to fetch from Nyamie:", err);
        return [];
      })
    ]);

    let upHellasFeatures = [];
    if (upHellasRes?.ok) {
      const data = await upHellasRes.json();
      upHellasFeatures = Array.isArray(data.features) ? data.features : [];
    }

    // Filter Nyamie venues locally by the requested bounding box
    const filteredNyamie = nyamieAllFeatures.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const { north_west, south_east } = bounds;
      
      return (
        lat <= north_west.latitude &&
        lat >= south_east.latitude &&
        lng >= north_west.longitude &&
        lng <= south_east.longitude
      );
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features: [...upHellasFeatures, ...filteredNyamie]
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


