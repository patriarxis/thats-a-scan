import { ICONS } from "@/shared/icons";
import type { TextureCategory } from "./types";

export type CategoryDefinition = {
  id: TextureCategory;
  label: string;
  icon: ICONS;
  color: string;
};

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { id: "graffiti", label: "Graffiti", icon: ICONS.PALETTE, color: "#E84420" },
  { id: "street-art", label: "Street art", icon: ICONS.PALETTE, color: "#9333EA" },
  { id: "marble", label: "Marble", icon: ICONS.BUILDINGS, color: "#E8E4DC" },
  { id: "stone", label: "Stone", icon: ICONS.BUILDINGS, color: "#A8A29E" },
  { id: "tile", label: "Tile", icon: ICONS.BUILDINGS, color: "#059669" },
  { id: "rust", label: "Rust", icon: ICONS.SHIELD_CHECK, color: "#B45309" },
  { id: "peeling-paint", label: "Peeling paint", icon: ICONS.PALETTE, color: "#F59E0B" },
  { id: "concrete", label: "Concrete", icon: ICONS.BUILDINGS, color: "#78716C" },
  { id: "signage", label: "Signage", icon: ICONS.STOREFRONT, color: "#1E3A5F" },
  { id: "poster", label: "Posters", icon: ICONS.BOOK_OPEN_TEXT, color: "#DC2626" },
  { id: "stencil", label: "Stencil", icon: ICONS.PALETTE, color: "#1A1A1A" },
  { id: "metal", label: "Metal", icon: ICONS.SHIELD_CHECK, color: "#64748B" },
  { id: "wood", label: "Wood", icon: ICONS.BUILDINGS, color: "#92400E" },
  { id: "fabric", label: "Fabric", icon: ICONS.SHOPPING_BAG, color: "#7C3AED" },
  { id: "other", label: "Other", icon: ICONS.STOREFRONT, color: "#6B7280" },
];

export const CATEGORY_COLORS: Record<TextureCategory, string> = Object.fromEntries(
  CATEGORY_DEFINITIONS.map((c) => [c.id, c.color]),
) as Record<TextureCategory, string>;

/** Payload / CMS select options — single source of truth for category values */
export const CATEGORY_SELECT_OPTIONS = CATEGORY_DEFINITIONS.map(({ id, label }) => ({
  label,
  value: id,
}));

const QUICK_FILTER_IDS: TextureCategory[] = [
  "graffiti",
  "marble",
  "rust",
  "stencil",
  "poster",
  "signage",
  "concrete",
  "tile",
];

export function getCategoryDefinition(id: TextureCategory): CategoryDefinition {
  return CATEGORY_DEFINITIONS.find((c) => c.id === id) ?? CATEGORY_DEFINITIONS.at(-1)!;
}

export function getCategoryLabel(id: TextureCategory): string {
  return getCategoryDefinition(id).label;
}

/** Broad surface type for modal header (Wall, Poster, Surface, …) */
const CATEGORY_GROUP_LABELS: Record<TextureCategory, string> = {
  graffiti: "Wall",
  "street-art": "Wall",
  stencil: "Wall",
  "peeling-paint": "Wall",
  poster: "Poster",
  marble: "Surface",
  stone: "Surface",
  concrete: "Surface",
  wood: "Surface",
  tile: "Floor",
  rust: "Metal",
  metal: "Metal",
  signage: "Signage",
  fabric: "Fabric",
  other: "Texture",
};

export function getCategoryGroupLabel(id: TextureCategory): string {
  return CATEGORY_GROUP_LABELS[id] ?? "Texture";
}

export function getQuickFilterCategories() {
  return QUICK_FILTER_IDS.map((id) => {
    const def = getCategoryDefinition(id);
    return { id, label: def.label, icon: def.icon, color: def.color };
  });
}

export function textureMatchesCategory(
  category: TextureCategory,
  filterId: TextureCategory,
): boolean {
  return category === filterId;
}

export function findCategoriesForQuery(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return getQuickFilterCategories().filter((cat) =>
    cat.label.toLowerCase().includes(q),
  );
}
