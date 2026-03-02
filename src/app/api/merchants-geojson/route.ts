import { NextResponse } from "next/server";

const API_URL = "https://merchants-map.uphellas.gr/geojson/search";

export async function GET() {
  // Broad bounding box over Greece; adjust as needed.
  const body = {
    north_west: {
      latitude: 42.5,
      longitude: 19.0
    },
    south_east: {
      latitude: 34.0,
      longitude: 29.5
    }
  };

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

