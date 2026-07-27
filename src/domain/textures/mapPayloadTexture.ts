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

function publicBaseUrl(): string {
  return (process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(
    /\/$/,
    "",
  );
}

function isMedia(value: unknown): value is Media {
  return typeof value === "object" && value !== null && "id" in value;
}

export function resolveMediaUrl(media: number | Media | null | undefined): string {
  if (!media || typeof media === "number") return "";

  const raw = media.url ?? (media.filename ? `/media/${media.filename}` : "");
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const base = publicBaseUrl();
  if (!base) return raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
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

function formatFromMedia(media: Media): TextureFileFormat {
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
  return "png";
}

function mapTagLabels(texture: Texture): string[] {
  if (!texture.tags?.length) return [];

  return texture.tags
    .map((entry) => {
      if (typeof entry === "number") return "";
      const tag = entry as Tag | { tag?: string };
      if ("label" in tag && tag.label) return tag.label;
      if ("tag" in tag && tag.tag) return tag.tag;
      return "";
    })
    .filter(Boolean);
}

function assetFromMedia(
  texture: Texture,
  label: string,
  media: Media,
  index: number,
  previewUrl: string,
  description?: string,
): TextureAsset {
  const fileUrl = resolveMediaUrl(media);
  const format =
    (texture.assets?.[index]?.format as TextureFileFormat | undefined) ?? formatFromMedia(media);

  return {
    id: `${texture.textureId}-media-${media.id ?? index}`,
    label,
    description,
    previewUrl: previewUrl || fileUrl,
    format,
    downloadUrl: fileUrl,
    sizeBytes: mediaSizeBytes(media),
    dimensions:
      mediaDimensions(media) ??
      (texture.assets?.[index]?.width && texture.assets?.[index]?.height
        ? {
            width: texture.assets[index]!.width!,
            height: texture.assets[index]!.height!,
          }
        : undefined),
  };
}

function mapAssets(texture: Texture, previewUrl: string, previewMedia?: Media): TextureAsset[] {
  if (texture.assets?.length) {
    return texture.assets.flatMap((asset, index) => {
      if (!isMedia(asset.file)) return [];
      const fileUrl = resolveMediaUrl(asset.file);
      const format = (asset.format as TextureFileFormat | undefined) ?? formatFromMedia(asset.file);
      return [
        {
          id: asset.id ?? `${texture.textureId}-asset-${index}`,
          label: asset.label,
          description: asset.description ?? undefined,
          previewUrl: previewUrl || fileUrl,
          format,
          downloadUrl: fileUrl,
          sizeBytes: mediaSizeBytes(asset.file),
          dimensions:
            asset.width && asset.height
              ? { width: asset.width, height: asset.height }
              : mediaDimensions(asset.file),
        },
      ];
    });
  }

  const fallback: TextureAsset[] = [];
  if (previewMedia) {
    fallback.push(
      assetFromMedia(texture, "Preview", previewMedia, 0, previewUrl, texture.description),
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
