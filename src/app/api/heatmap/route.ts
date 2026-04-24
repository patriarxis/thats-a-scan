import { NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/heatmapUtils";

// Cache for 30 days (precomputed-style ISR)
export const revalidate = 2592000;
const HEATMAP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let cachedHeatmap:
  | { createdAt: number; features: Awaited<ReturnType<typeof getHeatmapData>> }
  | null = null;
let inFlightHeatmapPromise: Promise<Awaited<ReturnType<typeof getHeatmapData>>> | null = null;

async function getCachedHeatmapFeatures() {
  const now = Date.now();
  if (cachedHeatmap && now - cachedHeatmap.createdAt < HEATMAP_TTL_MS) {
    return cachedHeatmap.features;
  }

  if (!inFlightHeatmapPromise) {
    inFlightHeatmapPromise = getHeatmapData()
      .then((features) => {
        cachedHeatmap = { createdAt: Date.now(), features };
        return features;
      })
      .finally(() => {
        inFlightHeatmapPromise = null;
      });
  }

  return inFlightHeatmapPromise;
}

export async function GET() {
  try {
    const features = await getCachedHeatmapFeatures();

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
