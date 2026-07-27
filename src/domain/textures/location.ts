import type { TextureFeature } from "./types";

const DEFAULT_CITY = "Athens";

/** Strip trailing city (and optional country) from a street address line. */
function stripCityFromAddress(address: string, city: string): string {
  const pattern = new RegExp(`[,\\s]+${city}(\\s*,\\s*Greece)?$`, "i");
  return address.replace(pattern, "").trim();
}

/**
 * Formats location as: `{street}, {neighborhood}, {city}`
 * e.g. "Skoufa 45, Kolonaki, Athens"
 */
export function formatTextureAddress(texture: TextureFeature): string {
  const { address, neighborhood } = texture.properties;
  const city = DEFAULT_CITY;

  if (!address && !neighborhood) return "";

  const street = address ? stripCityFromAddress(address, city) : "";
  const parts = [street, neighborhood, city].filter(Boolean);

  return parts.join(", ");
}
