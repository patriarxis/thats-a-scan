import { CARTO_DARK_STYLE, MAPBOX_DARK_STYLE_URL } from "./mapViewConstants";

export const resolveMapStyle = (hasToken: boolean) =>
  hasToken ? MAPBOX_DARK_STYLE_URL : CARTO_DARK_STYLE;
