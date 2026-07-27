import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import { withClientIds } from "./textureMarkerVisual";

export type TextureDeclutterStickyState = {
  zoomQuantum: number;
  cellWinners: Map<string, string>;
};

export const dedupeByTextureId = (features: TextureFeature[]): TextureFeature[] => {
  const byId = new Map<string, TextureFeature>();
  for (const feature of features) {
    byId.set(getTextureId(feature), feature);
  }
  return Array.from(byId.values());
};

export const buildTexturesFeatureCollection = (
  _map: MapLibreMap,
  items: TextureFeature[],
  alwaysKeepIds?: ReadonlySet<string>,
  _sticky?: TextureDeclutterStickyState,
  _searchPinnedIds?: ReadonlySet<string>,
  selectedTextureId: string | null = null,
) => {
  const deduped = dedupeByTextureId(items);
  const withStates = deduped.map((feature) => {
    const id = getTextureId(feature);
    const isSelected = id === selectedTextureId;
    const isPinned = alwaysKeepIds?.has(id) ?? false;
    const markerState = isSelected || isPinned ? "default" : "default";
    return {
      ...feature,
      properties: {
        ...feature.properties,
        __marker_state: markerState as "default" | "small" | "hidden",
      },
    };
  });

  return {
    type: "FeatureCollection" as const,
    features: withClientIds(withStates),
  };
};
