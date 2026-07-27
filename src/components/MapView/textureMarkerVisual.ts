import { CATEGORY_COLORS } from "@/domain/textures/categories";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";

const sanitizeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const buildMarkerIconId = (textureId: string): string =>
  `texture-preview-${sanitizeId(textureId)}`;

export const buildActiveMarkerIconId = (textureId: string): string =>
  `texture-preview-active-${sanitizeId(textureId)}`;

export const withClientIds = (features: TextureFeature[]): TextureFeature[] =>
  features.map((feature) => {
    const id = getTextureId(feature);
    const color = feature.properties.color ?? CATEGORY_COLORS[feature.properties.category] ?? "#6B7280";
    return {
      ...feature,
      properties: {
        ...feature.properties,
        __texture_id: id,
        __marker_dot_color: color,
        __marker_icon: buildMarkerIconId(id),
        __marker_icon_active: buildActiveMarkerIconId(id),
      },
    };
  });

export const resolveMarkerColor = (feature: TextureFeature): string =>
  feature.properties.color ?? CATEGORY_COLORS[feature.properties.category] ?? "#6B7280";
