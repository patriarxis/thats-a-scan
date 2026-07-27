import type { MapGeoJSONFeature } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";

export function textureFromMapFeature(
  mapFeature: MapGeoJSONFeature,
  store: Map<string, TextureFeature>,
): TextureFeature | null {
  const props = mapFeature.properties ?? {};
  const textureId = String(props.__texture_id ?? props.id ?? props.slug ?? "");
  if (!textureId) return null;

  const stored = store.get(textureId);
  if (stored) return stored;

  if (mapFeature.geometry.type !== "Point") return null;
  const coordinates = mapFeature.geometry.coordinates as [number, number];
  if (!props.id && !props.slug) return null;

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: props as TextureFeature["properties"],
  };
}

export function mergeTexturesIntoStore(
  store: Map<string, TextureFeature>,
  textures: TextureFeature[],
) {
  for (const texture of textures) {
    store.set(getTextureId(texture), texture);
  }
}
