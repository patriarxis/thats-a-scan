import type { TextureAsset, TextureFeature, TextureFile } from "./types";

export function getTextureAssets(texture: TextureFeature): TextureAsset[] {
  const props = texture.properties;

  if (props.assets && props.assets.length > 0) {
    return props.assets;
  }

  return props.files.map((file, index) => fileToAsset(file, props, index));
}

function fileToAsset(
  file: TextureFile,
  props: TextureFeature["properties"],
  index: number,
): TextureAsset {
  return {
    id: `${props.id}-${index}`,
    label: file.label ?? `${file.format.toUpperCase()} download`,
    description: props.dimensions
      ? `${props.dimensions.width} × ${props.dimensions.height}px`
      : undefined,
    previewUrl: file.previewUrl ?? props.previewUrl,
    format: file.format,
    downloadUrl: file.url,
    sizeBytes: file.sizeBytes,
    dimensions: props.dimensions,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
