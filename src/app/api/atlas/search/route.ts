import { NextResponse } from "next/server";
import { SEARCH_MAP_MIN_QUERY_LENGTH, SEARCH_SUGGESTION_LIMIT } from "@/config/search";
import { searchTextures } from "@/domain/textures/repository";

/**
 * `GET /api/atlas/search?q=<query>&limit=<n>` — scored search over the
 * published catalog, returned as a FeatureCollection so callers can hand the
 * results straight to the map.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();

  if (query.length < SEARCH_MAP_MIN_QUERY_LENGTH) {
    return NextResponse.json({
      type: "FeatureCollection",
      features: [],
      meta: { query, total: 0, minQueryLength: SEARCH_MAP_MIN_QUERY_LENGTH },
    });
  }

  const requested = Number(params.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), SEARCH_SUGGESTION_LIMIT)
      : SEARCH_SUGGESTION_LIMIT;

  try {
    const features = await searchTextures(query, limit);
    return NextResponse.json({
      type: "FeatureCollection",
      features,
      meta: { query, total: features.length, limit },
    });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
