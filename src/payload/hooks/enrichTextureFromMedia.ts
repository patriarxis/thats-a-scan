import type { CollectionBeforeChangeHook } from "payload";
import type { Media } from "../payload-types.ts";

const FORMAT_FROM_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function formatFromMedia(media: Media): string {
  if (media.mimeType && FORMAT_FROM_MIME[media.mimeType]) {
    return FORMAT_FROM_MIME[media.mimeType]!;
  }
  const ext = media.filename?.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "svg") return "svg";
  if (ext === "webp") return "webp";
  if (ext === "pdf") return "pdf";
  return "png";
}

async function resolveMedia(
  file: number | Media | null | undefined,
  req: Parameters<CollectionBeforeChangeHook>[0]["req"],
): Promise<Media | null> {
  if (!file) return null;
  if (typeof file === "object") return file;
  try {
    return await req.payload.findByID({ collection: "media", id: file, depth: 0 });
  } catch {
    return null;
  }
}

export const enrichTextureFromMedia: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data;

  const next = { ...data };

  if (!next.thumbnail && next.preview) {
    next.thumbnail = next.preview;
  }

  if (Array.isArray(next.assets)) {
    next.assets = await Promise.all(
      next.assets.map(async (asset) => {
        if (!asset?.file) return asset;
        const media = await resolveMedia(asset.file as number | Media, req);
        if (!media) return asset;

        return {
          ...asset,
          format: formatFromMedia(media),
          width: media.width ?? undefined,
          height: media.height ?? undefined,
        };
      }),
    );
  }

  return next;
};
