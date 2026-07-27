import { formatFileSize, getTextureAssets } from "./assets";
import type { TextureAsset, TextureFeature } from "./types";

export type DownloadOption = {
  id: string;
  label: string;
  format: string;
  sizeBytes: number;
  url: string;
};

export function assetToDownloadOption(asset: TextureAsset): DownloadOption {
  return {
    id: asset.id,
    label: asset.label,
    format: asset.format.toUpperCase(),
    sizeBytes: asset.sizeBytes,
    url: asset.downloadUrl,
  };
}

export function getTextureDownloadOptions(texture: TextureFeature): DownloadOption[] {
  return getTextureAssets(texture).map(assetToDownloadOption);
}

export function getAssetDownloadOptions(asset: TextureAsset): DownloadOption[] {
  return [assetToDownloadOption(asset)];
}

/** Format options for the selected asset; falls back to all files when no explicit assets. */
export function getSelectedAssetDownloadOptions(
  texture: TextureFeature,
  asset: TextureAsset,
): DownloadOption[] {
  const { assets, files } = texture.properties;

  if (!assets || assets.length === 0) {
    return files.map((file, index) => ({
      id: `${texture.properties.id}-file-${index}`,
      label: file.label ?? `${file.format.toUpperCase()} download`,
      format: file.format.toUpperCase(),
      sizeBytes: file.sizeBytes,
      url: file.url,
    }));
  }

  return [assetToDownloadOption(asset)];
}

/** Dedupe by download URL so "download all" does not fetch the same file twice. */
export function uniqueDownloadOptions(options: DownloadOption[]): DownloadOption[] {
  const seen = new Set<string>();
  return options.filter((opt) => {
    if (seen.has(opt.url)) return false;
    seen.add(opt.url);
    return true;
  });
}

export function formatDownloadOptionMeta(option: DownloadOption): string {
  return `${option.format} · ${formatFileSize(option.sizeBytes)}`;
}

const DOWNLOAD_STAGGER_MS = 350;

export function triggerFileDownload(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function triggerDownloadAll(options: DownloadOption[]): Promise<void> {
  const unique = uniqueDownloadOptions(options);
  for (let i = 0; i < unique.length; i++) {
    triggerFileDownload(unique[i].url);
    if (i < unique.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_STAGGER_MS));
    }
  }
}
