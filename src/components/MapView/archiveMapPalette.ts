/**
 * Dark-neutral map palette with brand orange accent.
 * Keep in sync with src/styles/abstracts/_variables.scss archive tokens.
 */
export const ARCHIVE_MAP_PALETTE = {
  /** Default canvas — visible land where no feature fill is drawn */
  background: "#161616",
  land: "#161616",
  landuse: "#1c1c1c",
  park: "#191919",
  water: "#0b0b0b",
  waterway: "#0b0b0b",
  building: "#222222",
  buildingTop: "#2a2a2a",
  roadService: "#262626",
  roadMinor: "#333333",
  roadSecondary: "#454545",
  roadPrimary: "#585858",
  roadMajor: "#6a6a6a",
  roadPath: "#2e2e2e",
  roadCase: "#101010",
  boundary: "#404040",
  rail: "#555555",
  labelPrimary: "#e0e0e0",
  labelSecondary: "#b0b0b0",
  labelMuted: "#888888",
  labelWater: "#8a8a8a",
  labelHalo: "#161616",
  accent: "#ff8500",
} as const;

export type ArchiveMapPalette = typeof ARCHIVE_MAP_PALETTE;
