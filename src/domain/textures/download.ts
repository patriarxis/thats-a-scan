import { ATLAS_DOWNLOAD_API_PATH } from "@/config/map";
import { formatFileSize, getTextureAssets } from "./assets";
import { getTextureId, type TextureAsset, type TextureFeature } from "./types";

export type DownloadOption = {
  id: string;
  label: string;
  format: string;
  sizeBytes: number;
  url: string;
};

/**
 * Downloads go through the same-origin proxy rather than straight at the
 * storage URL: `anchor.download` is ignored cross-origin, so a direct R2 link
 * navigates to the file instead of saving it.
 */
export function buildAssetDownloadUrl(textureId: string, assetId: string): string {
  const params = new URLSearchParams({ texture: textureId, asset: assetId });
  return `${ATLAS_DOWNLOAD_API_PATH}?${params.toString()}`;
}

export function assetToDownloadOption(asset: TextureAsset, textureId: string): DownloadOption {
  return {
    id: asset.id,
    label: asset.label,
    format: asset.format.toUpperCase(),
    sizeBytes: asset.sizeBytes,
    url: buildAssetDownloadUrl(textureId, asset.id),
  };
}

export function getTextureDownloadOptions(texture: TextureFeature): DownloadOption[] {
  const textureId = getTextureId(texture);
  return getTextureAssets(texture).map((asset) => assetToDownloadOption(asset, textureId));
}

export function getAssetDownloadOptions(
  asset: TextureAsset,
  textureId: string,
): DownloadOption[] {
  return [assetToDownloadOption(asset, textureId)];
}

/** Format options for the selected asset; falls back to all files when no explicit assets. */
export function getSelectedAssetDownloadOptions(
  texture: TextureFeature,
  asset: TextureAsset,
): DownloadOption[] {
  const textureId = getTextureId(texture);
  const { assets } = texture.properties;

  // Without an explicit asset list the modal offers every file. Derive those
  // through `getTextureAssets` so the ids match what the download route looks up.
  if (!assets || assets.length === 0) {
    return getTextureAssets(texture).map((candidate) =>
      assetToDownloadOption(candidate, textureId),
    );
  }

  return [assetToDownloadOption(asset, textureId)];
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
  // Same-origin, so this is honoured — though the proxy's Content-Disposition
  // header supplies the actual filename and takes precedence.
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
