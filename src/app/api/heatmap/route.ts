import { NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/heatmapUtils";

// Cache for 30 days (precomputed-style ISR)
export const revalidate = 2592000;

export async function GET() {
  try {
    const features = await getHeatmapData();

    return NextResponse.json({
      type: "FeatureCollection",
      features: features,
    });
  } catch (error) {
    console.error("Heatmap API error:", error);
    return NextResponse.json(
      { error: "Failed to generate heatmap data" },
      { status: 500 }
    );
  }
}

// Allow manual refresh via POST (optional, good for testing)
export async function POST() {
  return GET();
}
