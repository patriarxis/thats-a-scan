import { NextResponse } from "next/server";
import {
  HEATMAP_CACHE_CONTROL,
  canUseHeatmapBlobStore,
  generateHeatmapCollection,
  getStoredHeatmapBlob,
  serializeHeatmap,
  uploadHeatmapToBlob,
} from "@/lib/heatmapStore";

export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Content-Type": "application/geo+json; charset=utf-8",
  "Cache-Control": HEATMAP_CACHE_CONTROL,
  "X-Content-Type-Options": "nosniff",
};

let cachedFallbackHeatmap:
  | { createdAt: number; body: string; featureCount: number }
  | null = null;
let inFlightFallbackPromise:
  | Promise<{ body: string; featureCount: number }>
  | null = null;
const FALLBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function getFallbackHeatmapBody() {
  const now = Date.now();
  if (cachedFallbackHeatmap && now - cachedFallbackHeatmap.createdAt < FALLBACK_TTL_MS) {
    return {
      body: cachedFallbackHeatmap.body,
      featureCount: cachedFallbackHeatmap.featureCount,
    };
  }

  if (!inFlightFallbackPromise) {
    inFlightFallbackPromise = generateHeatmapCollection()
      .then(async ({ collection, generatedAt, featureCount }) => {
        const body = serializeHeatmap(collection);
        cachedFallbackHeatmap = { createdAt: Date.now(), body, featureCount };

        if (canUseHeatmapBlobStore()) {
          try {
            await uploadHeatmapToBlob(collection, generatedAt);
          } catch (error) {
            console.error("Failed to upload fallback heatmap to Blob:", error);
          }
        }

        return { body, featureCount };
      })
      .finally(() => {
        inFlightFallbackPromise = null;
      });
  }

  return inFlightFallbackPromise;
}

export async function GET(request: Request) {
  try {
    const ifNoneMatch = request.headers.get("if-none-match");
    let storedBlob = null;
    try {
      storedBlob = await getStoredHeatmapBlob(ifNoneMatch);
    } catch (error) {
      console.error("Failed to read heatmap from Blob:", error);
    }

    if (storedBlob?.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: JSON_HEADERS,
      });
    }

    if (storedBlob?.statusCode === 200) {
      return new NextResponse(storedBlob.stream, {
        headers: {
          ...JSON_HEADERS,
          ETag: storedBlob.blob.etag,
          "Last-Modified": storedBlob.blob.uploadedAt.toUTCString(),
        },
      });
    }

    const { body, featureCount } = await getFallbackHeatmapBody();
    return new NextResponse(body, {
      headers: {
        ...JSON_HEADERS,
        "X-Heatmap-Fallback": "generated",
        "X-Heatmap-Feature-Count": String(featureCount),
      },
    });
  } catch (error) {
    console.error("Heatmap API error:", error);
    return NextResponse.json(
      { error: "Failed to generate heatmap data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
