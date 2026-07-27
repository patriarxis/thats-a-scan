import { getSiteUrl } from "@/lib/siteUrl";
import { getTextureId, type TextureFeature } from "./types";

export function buildTextureShareUrl(
  textureId: string,
  lat: number,
  lng: number,
): string {
  const base = getSiteUrl();
  const path = `/texture/${encodeURIComponent(textureId)}`;
  const url = new URL(path, base);
  if (Number.isFinite(lat)) url.searchParams.set("lat", String(lat));
  if (Number.isFinite(lng)) url.searchParams.set("lng", String(lng));
  return url.toString();
}

export function buildTextureShareUrlFromFeature(feature: TextureFeature): string {
  const [lng, lat] = feature.geometry.coordinates;
  return buildTextureShareUrl(getTextureId(feature), lat, lng);
}
