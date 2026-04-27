import { NextResponse } from "next/server";
import {
  canUseHeatmapBlobStore,
  regenerateHeatmapBlob,
} from "@/lib/heatmapStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.NODE_ENV !== "production") return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canUseHeatmapBlobStore()) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await regenerateHeatmapBlob();
    return NextResponse.json({
      ok: true,
      pathname: result.blob.pathname,
      featureCount: result.featureCount,
      byteLength: result.byteLength,
      generatedAt: result.generatedAt,
    });
  } catch (error) {
    console.error("Heatmap cron error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate heatmap" },
      { status: 500 },
    );
  }
}
