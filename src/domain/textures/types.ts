export type TextureCategory =
  | "graffiti"
  | "street-art"
  | "marble"
  | "stone"
  | "tile"
  | "rust"
  | "peeling-paint"
  | "concrete"
  | "signage"
  | "poster"
  | "stencil"
  | "metal"
  | "wood"
  | "fabric"
  | "other";

export type TextureLicense =
  | "personal"
  | "commercial"
  | "cc-by"
  | "all-rights-reserved";

export type TextureFileFormat = "jpg" | "png" | "pdf" | "svg" | "webp";

export type TextureFile = {
  format: TextureFileFormat;
  url: string;
  sizeBytes: number;
  label?: string;
  previewUrl?: string;
};

/** A downloadable variant or crop of a texture location */
export type TextureAsset = {
  id: string;
  label: string;
  description?: string;
  previewUrl: string;
  format: TextureFileFormat;
  downloadUrl: string;
  sizeBytes: number;
  dimensions?: { width: number; height: number };
};

export type TextureProperties = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: TextureCategory;
  tags: string[];
  neighborhood: string;
  color?: string;
  files: TextureFile[];
  /** Optional explicit asset list (variants, crops, formats). Falls back to `files`. */
  assets?: TextureAsset[];
  thumbnailUrl: string;
  previewUrl: string;
  scannedAt: string;
  scannedBy: string;
  dimensions?: { width: number; height: number };
  dpi?: number;
  address?: string;
  locationNote?: string;
  accuracy?: number;
  license: TextureLicense;
  /** Runtime map marker state — not persisted in source data */
  __marker_fade?: number;
  __texture_id?: string;
  __marker_icon?: string;
  __marker_icon_active?: string;
  __marker_state?: "hidden" | "small" | "default";
  __marker_dot_color?: string;
  [key: string]: unknown;
};

export type TextureFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: TextureProperties;
};

export type TextureFeatureCollection = {
  type: "FeatureCollection";
  features: TextureFeature[];
};

export type MapBounds = {
  north_west: { latitude: number; longitude: number };
  south_east: { latitude: number; longitude: number };
};

export type VisibleTexturesPayload = {
  textures: TextureFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
  error: string | null;
};

export const getTextureId = (feature: TextureFeature): string =>
  String(feature.properties.id ?? feature.properties.slug ?? "");

export const getTextureTitle = (feature: TextureFeature): string =>
  feature.properties.title;

export const getTextureDescription = (feature: TextureFeature): string =>
  feature.properties.description;
