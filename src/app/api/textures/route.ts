import { NextResponse } from "next/server";
import { filterTexturesByBounds, loadTextures } from "@/domain/textures/repository";
import type { MapBounds } from "@/domain/textures/types";

export async function POST(request: Request) {
  try {
    const bounds = (await request.json()) as MapBounds;
    const { north_west, south_east } = bounds;

    if (
      !north_west?.latitude ||
      !north_west?.longitude ||
      !south_east?.latitude ||
      !south_east?.longitude
    ) {
      return NextResponse.json({ error: "Invalid bounds" }, { status: 400 });
    }

    const collection = await loadTextures();
    const features = filterTexturesByBounds(collection.features, bounds);

    return NextResponse.json({
      type: "FeatureCollection",
      features,
      meta: { total: features.length, loadedAt: Date.now() },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load textures" }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadTextures());
  } catch {
    return NextResponse.json({ error: "Failed to load textures" }, { status: 500 });
  }
}
