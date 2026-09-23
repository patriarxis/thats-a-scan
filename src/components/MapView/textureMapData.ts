import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import { withClientIds } from "./textureMarkerVisual";
import { DECLUTTER_ZOOM_QUANTUM, declutterProfileForZoom } from "./mapViewConstants";

export type TextureDeclutterStickyState = {
  zoomQuantum: number;
  cellWinners: Map<string, string>;
};

type MarkerState = "default" | "small" | "hidden";

export const dedupeByTextureId = (features: TextureFeature[]): TextureFeature[] => {
  const byId = new Map<string, TextureFeature>();
  for (const feature of features) {
    byId.set(getTextureId(feature), feature);
  }
  return Array.from(byId.values());
};

/**
 * Grid cell a feature falls into at the current zoom, or null when the profile
 * has no grid (high zoom — everything gets its own icon).
 */
const cellKeyFor = (
  map: MapLibreMap,
  feature: TextureFeature,
  cellSizePx: number | null,
): string | null => {
  if (cellSizePx === null) return null;
  const [lng, lat] = feature.geometry.coordinates;
  let point;
  try {
    point = map.project([lng, lat]);
  } catch {
    return null;
  }
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return `${Math.floor(point.x / cellSizePx)}:${Math.floor(point.y / cellSizePx)}`;
};

/**
 * Assigns each marker a render state from the zoom profile.
 *
 * - `default` — full icon
 * - `small`   — collapsed to a dot
 * - `hidden`  — dropped entirely
 *
 * Pinned ids (the open texture, and any active search hit) always keep their
 * icon: that is what lets a search result stay visible at zoom levels where its
 * neighbours collapse.
 */
export const buildTexturesFeatureCollection = (
  map: MapLibreMap,
  items: TextureFeature[],
  alwaysKeepIds?: ReadonlySet<string>,
  sticky?: TextureDeclutterStickyState,
  searchPinnedIds?: ReadonlySet<string>,
  selectedTextureId: string | null = null,
) => {
  const deduped = dedupeByTextureId(items);
  const zoom = map.getZoom();
  const profile = declutterProfileForZoom(zoom);

  // Cell winners are kept across small zoom changes so markers do not swap
  // between icon and dot while the user is mid-gesture.
  const zoomQuantum = Math.round(zoom / DECLUTTER_ZOOM_QUANTUM);
  if (sticky && sticky.zoomQuantum !== zoomQuantum) {
    sticky.zoomQuantum = zoomQuantum;
    sticky.cellWinners.clear();
  }

  const isPinned = (id: string): boolean =>
    id === selectedTextureId ||
    (alwaysKeepIds?.has(id) ?? false) ||
    (searchPinnedIds?.has(id) ?? false);

  const iconBudget = Math.max(1, Math.round(profile.maxVisible * profile.iconShare));
  const perCellCount = new Map<string, number>();
  const states = new Map<string, MarkerState>();

  let iconsUsed = 0;
  let visibleUsed = 0;
  let dotOverflowUsed = 0;

  // Pinned markers claim their icon first, so a crowded cell can never push the
  // selected texture or a search hit out.
  const ordered = [...deduped].sort((a, b) => {
    const pinnedA = isPinned(getTextureId(a)) ? 0 : 1;
    const pinnedB = isPinned(getTextureId(b)) ? 0 : 1;
    return pinnedA - pinnedB;
  });

  for (const feature of ordered) {
    const id = getTextureId(feature);

    if (isPinned(id)) {
      states.set(id, "default");
      iconsUsed += 1;
      visibleUsed += 1;
      const cell = cellKeyFor(map, feature, profile.cellSizePx);
      if (cell) {
        perCellCount.set(cell, (perCellCount.get(cell) ?? 0) + 1);
        if (!sticky?.cellWinners.has(cell)) sticky?.cellWinners.set(cell, id);
      }
      continue;
    }

    if (visibleUsed >= profile.maxVisible) {
      states.set(id, "hidden");
      continue;
    }

    const cell = cellKeyFor(map, feature, profile.cellSizePx);
    let wantsIcon = iconsUsed < iconBudget;

    if (cell) {
      const used = perCellCount.get(cell) ?? 0;
      if (used >= profile.maxPerCell) {
        wantsIcon = false;
      } else {
        const winner = sticky?.cellWinners.get(cell);
        // One icon per cell; whoever got it last time keeps it.
        if (winner && winner !== id) wantsIcon = false;
        else if (wantsIcon) sticky?.cellWinners.set(cell, id);
      }
      perCellCount.set(cell, used + 1);
    }

    if (wantsIcon) {
      states.set(id, "default");
      iconsUsed += 1;
      visibleUsed += 1;
      continue;
    }

    if (profile.maxDotOverflow !== undefined && dotOverflowUsed >= profile.maxDotOverflow) {
      states.set(id, "hidden");
      continue;
    }

    states.set(id, "small");
    dotOverflowUsed += 1;
    visibleUsed += 1;
  }

  const withStates = deduped.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      __marker_state: states.get(getTextureId(feature)) ?? "default",
    },
  }));

  return {
    type: "FeatureCollection" as const,
    features: withClientIds(withStates),
  };
};
