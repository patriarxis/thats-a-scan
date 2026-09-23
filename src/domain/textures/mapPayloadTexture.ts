import type { Media, Tag, Texture } from "@/payload/payload-types";
import type {
  TextureAsset,
  TextureCategory,
  TextureFeature,
  TextureFile,
  TextureFileFormat,
  TextureLicense,
  TextureProperties,
} from "./types";
import { CATEGORY_COLORS } from "./categories";

function isMedia(value: unknown): value is Media {
  return typeof value === "object" && value !== null && "id" in value;
}

/**
 * With R2 on, Payload's `generateFileURL` already emits an absolute public URL.
 * With local storage it emits a site-relative `/api/media/file/...` path, which
 * the browser resolves against the current origin. Neither needs a prefix.
 */
export function resolveMediaUrl(media: number | Media | null | undefined): string {
  if (!media || typeof media === "number") return "";

  const raw = media.url ?? "";
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function mediaSizeBytes(media: number | Media | null | undefined): number {
  if (!media || typeof media === "number") return 0;
  return media.filesize ?? 0;
}

function mediaDimensions(
  media: number | Media | null | undefined,
): { width: number; height: number } | undefined {
  if (!media || typeof media === "number") return undefined;
  if (media.width && media.height) {
    return { width: media.width, height: media.height };
  }
  return undefined;
}

/** Returns undefined when neither the mime type nor the extension identifies it. */
function formatFromMedia(media: Media): TextureFileFormat | undefined {
  const mime = media.mimeType ?? "";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("pdf")) return "pdf";

  const ext = media.filename?.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "svg") return "svg";
  if (ext === "webp") return "webp";
  if (ext === "pdf") return "pdf";
  return undefined;
}

function mapTagLabels(texture: Texture): string[] {
  if (!texture.tags?.length) return [];

  // Numbers are unpopulated relations (depth: 0 reads) — there is no label to
  // show for those.
  return texture.tags
    .map((entry: number | Tag) => (typeof entry === "number" ? "" : entry.label))
    .filter(Boolean);
}

/** Formats a browser can render straight into an `<img>`. */
const INLINE_RENDERABLE: ReadonlySet<TextureFileFormat> = new Set<TextureFileFormat>([
  "jpg",
  "png",
  "svg",
  "webp",
]);

/**
 * An asset previews as its own file. Only formats that cannot render in an
 * `<img>` — PDFs — deliberately borrow the texture-level preview, so the modal
 * still has something to show.
 */
function assetPreviewUrl(
  format: TextureFileFormat,
  ownFileUrl: string,
  texturePreviewUrl: string,
): string {
  if (INLINE_RENDERABLE.has(format) && ownFileUrl) return ownFileUrl;
  return texturePreviewUrl || ownFileUrl;
}

function assetFromMedia(
  texture: Texture,
  label: string,
  media: Media,
  index: number,
  texturePreviewUrl: string,
  description?: string,
): TextureAsset {
  const fileUrl = resolveMediaUrl(media);
  const format = formatFromMedia(media) ?? "png";

  return {
    id: `${texture.textureId}-media-${media.id ?? index}`,
    label,
    description,
    previewUrl: assetPreviewUrl(format, fileUrl, texturePreviewUrl),
    format,
    downloadUrl: fileUrl,
    sizeBytes: mediaSizeBytes(media),
    dimensions: mediaDimensions(media),
  };
}

function mapAssets(
  texture: Texture,
  texturePreviewUrl: string,
  previewMedia?: Media,
): TextureAsset[] {
  if (texture.assets?.length) {
    return texture.assets.flatMap((asset, index) => {
      if (!isMedia(asset.file)) return [];
      const fileUrl = resolveMediaUrl(asset.file);
      // The live media record wins; the denormalised columns on the asset row
      // are only a cache and go stale when an editor swaps the file.
      const format =
        formatFromMedia(asset.file) ?? (asset.format as TextureFileFormat | undefined) ?? "png";
      return [
        {
          id: asset.id ?? `${texture.textureId}-asset-${index}`,
          label: asset.label,
          description: asset.description ?? undefined,
          previewUrl: assetPreviewUrl(format, fileUrl, texturePreviewUrl),
          format,
          downloadUrl: fileUrl,
          sizeBytes: mediaSizeBytes(asset.file),
          dimensions:
            mediaDimensions(asset.file) ??
            (asset.width && asset.height
              ? { width: asset.width, height: asset.height }
              : undefined),
        },
      ];
    });
  }

  const fallback: TextureAsset[] = [];
  if (previewMedia) {
    fallback.push(
      assetFromMedia(texture, "Preview", previewMedia, 0, texturePreviewUrl, texture.description),
    );
  }

  const thumbMedia = isMedia(texture.thumbnail) ? texture.thumbnail : null;
  if (thumbMedia && thumbMedia.id !== previewMedia?.id) {
    fallback.push(
      assetFromMedia(
        texture,
        "Thumbnail",
        thumbMedia,
        fallback.length,
        resolveMediaUrl(thumbMedia),
      ),
    );
  }

  return fallback;
}

function mapFiles(assets: TextureAsset[]): TextureFile[] {
  return assets.map((asset) => ({
    format: asset.format,
    url: asset.downloadUrl,
    sizeBytes: asset.sizeBytes,
    label: asset.label,
    previewUrl: asset.previewUrl,
  }));
}

export function mapPayloadTextureToFeature(texture: Texture): TextureFeature {
  const previewMedia = isMedia(texture.preview) ? texture.preview : undefined;
  const thumbnailMedia = isMedia(texture.thumbnail) ? texture.thumbnail : previewMedia;

  const thumbnailUrl = resolveMediaUrl(thumbnailMedia);
  const previewUrl = resolveMediaUrl(previewMedia);
  const assets = mapAssets(texture, previewUrl, previewMedia);
  const files = mapFiles(assets);
  const category = texture.category as TextureCategory;
  const primaryDimensions = assets[0]?.dimensions ?? mediaDimensions(previewMedia);

  const properties: TextureProperties = {
    id: texture.textureId,
    slug: texture.slug,
    title: texture.title,
    description: texture.description,
    category,
    tags: mapTagLabels(texture),
    neighborhood: texture.neighborhood,
    color: texture.markerColor ?? CATEGORY_COLORS[category],
    files,
    assets: assets.length > 0 ? assets : undefined,
    thumbnailUrl,
    previewUrl,
    scannedAt: texture.scannedAt ?? texture.createdAt,
    scannedBy: texture.scannedBy,
    dimensions: primaryDimensions,
    dpi: texture.dpi ?? undefined,
    address: texture.address ?? undefined,
    locationNote: texture.locationNote ?? undefined,
    license: texture.license as TextureLicense,
  };

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [texture.location.longitude, texture.location.latitude],
    },
    properties,
  };
}
