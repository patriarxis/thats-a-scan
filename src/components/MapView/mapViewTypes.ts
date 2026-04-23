import type { PaddingOptions } from "mapbox-gl";

export type MapViewHandle = {
  flyTo: (
    center: [number, number],
    zoom?: number,
    padding?: PaddingOptions,
    options?: { preserveHigherZoom?: boolean },
  ) => void;
  panTo: (center: [number, number], padding?: PaddingOptions) => void;
};
