import { normalizeString } from "@/lib/utils/string";
import type { TextureCategory, TextureFeature, TextureLicense } from "./types";
import { getTextureDescription, getTextureTitle } from "./types";

export type TextureFilterState = {
  categories: TextureCategory[];
  formats: string[];
  licenses: TextureLicense[];
  neighborhoods: string[];
  tags: string[];
};

export const EMPTY_TEXTURE_FILTERS: TextureFilterState = {
  categories: [],
  formats: [],
  licenses: [],
  neighborhoods: [],
  tags: [],
};

export function hasActiveFilters(filters: TextureFilterState): boolean {
  return (
    filters.categories.length > 0 ||
    filters.formats.length > 0 ||
    filters.licenses.length > 0 ||
    filters.neighborhoods.length > 0 ||
    filters.tags.length > 0
  );
}

export function countActiveFilters(filters: TextureFilterState): number {
  return (
    filters.categories.length +
    filters.formats.length +
    filters.licenses.length +
    filters.neighborhoods.length +
    filters.tags.length
  );
}

export function textureMatchesFilters(
  feature: TextureFeature,
  filters: TextureFilterState,
): boolean {
  const props = feature.properties;

  if (filters.categories.length > 0 && !filters.categories.includes(props.category)) {
    return false;
  }

  if (filters.licenses.length > 0 && !filters.licenses.includes(props.license)) {
    return false;
  }

  if (
    filters.neighborhoods.length > 0 &&
    !filters.neighborhoods.some(
      (n) => n.toLowerCase() === props.neighborhood.toLowerCase(),
    )
  ) {
    return false;
  }

  if (filters.formats.length > 0) {
    const fileFormats = props.files.map((f) => f.format);
    if (
      !filters.formats.some((fmt) =>
        fileFormats.includes(fmt as "jpg" | "png" | "pdf" | "svg" | "webp"),
      )
    ) {
      return false;
    }
  }

  if (filters.tags.length > 0) {
    const tags = props.tags.map((tag) => normalizeString(tag));
    if (!filters.tags.some((tag) => tags.includes(normalizeString(tag)))) {
      return false;
    }
  }

  return true;
}

/** Filter option lists derived from the loaded set, never hardcoded. */
export function collectFilterOptions(features: TextureFeature[]) {
  const neighborhoods = new Set<string>();
  const formats = new Set<string>();
  const tags = new Set<string>();
  const licenses = new Set<TextureLicense>();

  for (const feature of features) {
    const props = feature.properties;
    if (props.neighborhood) neighborhoods.add(props.neighborhood);
    if (props.license) licenses.add(props.license);
    for (const file of props.files) formats.add(file.format);
    for (const tag of props.tags) tags.add(tag);
  }

  const byLabel = (a: string, b: string) => a.localeCompare(b);

  return {
    neighborhoods: [...neighborhoods].sort(byLabel),
    formats: [...formats].sort(byLabel),
    tags: [...tags].sort(byLabel),
    licenses: [...licenses].sort(byLabel) as TextureLicense[],
  };
}

export function textureMatchesSearchQuery(
  feature: TextureFeature,
  query: string,
): boolean {
  const q = normalizeString(query);
  if (!q) return true;

  const haystack = normalizeString(
    [
      getTextureTitle(feature),
      getTextureDescription(feature),
      feature.properties.neighborhood,
      feature.properties.category,
      ...feature.properties.tags,
    ].join(" "),
  );

  return haystack.includes(q);
}

export function searchTextureSuggestions(
  textures: TextureFeature[],
  query: string,
  limit = 10,
): TextureFeature[] {
  const q = normalizeString(query);
  if (q.length < 2) return [];

  return textures
    .filter((t) => textureMatchesSearchQuery(t, query))
    .slice(0, limit);
}
