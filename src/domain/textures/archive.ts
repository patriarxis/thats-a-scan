import type { TextureFeature } from "./types";

/** Archive reference code, e.g. `tex_001` → `ATH-001`. */
export function formatSpecimenId(textureId: string): string {
  const raw = textureId.replace(/^tex_/i, "").toUpperCase();
  const numeric = raw.replace(/\D/g, "");
  return `ATH-${numeric.padStart(3, "0")}`;
}

export function getTextureSpecimenId(texture: TextureFeature): string {
  return formatSpecimenId(texture.properties.id);
}
