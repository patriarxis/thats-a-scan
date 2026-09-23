import { NextResponse } from "next/server";
import { getTextureAssets } from "@/domain/textures/assets";
import { findTextureById } from "@/domain/textures/repository";
import type { TextureAsset, TextureFeature } from "@/domain/textures/types";
import { getSiteUrl } from "@/lib/siteUrl";

/**
 * Same-origin download proxy.
 *
 * `anchor.download` is ignored for cross-origin URLs, so clicking Download on
 * an R2-hosted file navigated to the image instead of saving it. Streaming it
 * back through our own origin with `Content-Disposition: attachment` both fixes
 * that and gives the file a readable name instead of a storage hash.
 *
 * The asset is looked up in the catalog rather than taken from a `?url=`
 * parameter, so this cannot be used as an open proxy.
 */

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadFilename(texture: TextureFeature, asset: TextureAsset): string {
  const stem = [slugify(texture.properties.id), slugify(asset.label)].filter(Boolean).join("-");
  const extension = asset.format.toLowerCase();
  return `${stem || "texture"}.${extension}`;
}

/** Absolute URL for an asset, whether R2 gave us one or local storage a path. */
function upstreamUrl(downloadUrl: string): URL | null {
  try {
    if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
      return new URL(downloadUrl);
    }
    return new URL(downloadUrl, getSiteUrl());
  } catch {
    return null;
  }
}

/** Only our own origin and the configured public media bucket may be streamed. */
function isAllowedUpstream(target: URL): boolean {
  const allowed = new Set<string>([getSiteUrl().origin]);
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase) {
    try {
      allowed.add(new URL(publicBase).origin);
    } catch {
      /* malformed env value — simply not allowed */
    }
  }
  return allowed.has(target.origin);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const textureId = params.get("texture");
  const assetId = params.get("asset");

  if (!textureId || !assetId) {
    return NextResponse.json({ error: "texture and asset are required" }, { status: 400 });
  }

  let texture: TextureFeature | undefined;
  try {
    texture = await findTextureById(textureId);
  } catch {
    return NextResponse.json({ error: "Failed to load texture" }, { status: 500 });
  }
  if (!texture) {
    return NextResponse.json({ error: "Texture not found" }, { status: 404 });
  }

  const asset = getTextureAssets(texture).find((candidate) => candidate.id === assetId);
  if (!asset?.downloadUrl) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const target = upstreamUrl(asset.downloadUrl);
  if (!target || !isAllowedUpstream(target)) {
    return NextResponse.json({ error: "Asset is not downloadable" }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }

  const filename = downloadFilename(texture, asset);
  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("content-type") ??
      MIME_BY_FORMAT[asset.format] ??
      "application/octet-stream",
    // The ASCII form is the fallback; filename* carries the exact name.
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, max-age=0, must-revalidate",
  });

  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { status: 200, headers });
}
