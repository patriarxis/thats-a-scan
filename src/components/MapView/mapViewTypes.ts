import type { PaddingOptions } from "maplibre-gl";

export type MapViewHandle = {
  flyTo: (
    center: [number, number],
    zoom?: number,
    padding?: PaddingOptions,
    options?: { preserveHigherZoom?: boolean },
  ) => void;
  panTo: (center: [number, number], padding?: PaddingOptions) => void;
};
