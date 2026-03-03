import { NextResponse } from "next/server";

const API_URL = "https://merchants-map.uphellas.gr/geojson/search";

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
  let body: BBoxPayload = DEFAULT_ATHENS_BBOX;
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
      body = {
        north_west: { latitude: nwLat, longitude: nwLng },
        south_east: { latitude: seLat, longitude: seLng }
      };
    }
  } catch {
    body = DEFAULT_ATHENS_BBOX;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      // Revalidate periodically to keep data fresh but cache-friendly
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Up Hellas merchants API error:", text);
      return NextResponse.json(
        { error: "Failed to fetch merchants" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error calling Up Hellas merchants API:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching merchants" },
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
