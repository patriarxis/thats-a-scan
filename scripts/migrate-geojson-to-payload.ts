import { readFileSync } from "fs";
import { join } from "path";
import { existsSync } from "fs";
import { getPayload } from "payload";
import config from "../payload.config.ts";
import type { TextureFeatureCollection } from "../src/domain/textures/types.ts";
import { slugify } from "../src/payload/slug.ts";

type GeoJsonFeature = TextureFeatureCollection["features"][number] & {
  properties: {
    assets?: Array<{
      id: string;
      label: string;
      description?: string;
      previewUrl: string;
      format: string;
      downloadUrl: string;
      sizeBytes: number;
      dimensions?: { width: number; height: number };
    }>;
    files?: Array<{
      format: string;
      url: string;
      sizeBytes: number;
      label?: string;
    }>;
    color?: string;
    dpi?: number;
    scannedAt?: string;
    locationNote?: string;
  };
};

const mediaCache = new Map<string, number>();

/**
 * Every primary file that was not on disk. A migration that reports success
 * while quietly uploading placeholder art is worse than one that fails, so
 * these are surfaced individually and make the run exit non-zero.
 */
const fallbacks: Array<{ missing: string; substituted: string }> = [];
const missingEntirely: string[] = [];

function resolvePublicFile(urlPath: string): string | null {
  if (!urlPath.startsWith("/")) return null;
  const absolute = join(process.cwd(), "public", urlPath.replace(/^\//, ""));
  return existsSync(absolute) ? absolute : null;
}

async function uploadMedia(
  payload: Awaited<ReturnType<typeof getPayload>>,
  urlPath: string,
  alt: string,
): Promise<number | null> {
  if (mediaCache.has(urlPath)) return mediaCache.get(urlPath)!;

  const filePath = resolvePublicFile(urlPath);
  if (!filePath) return null;

  const doc = await payload.create({
    collection: "media",
    data: { alt },
    filePath,
  });

  mediaCache.set(urlPath, doc.id);
  return doc.id;
}

async function uploadWithFallback(
  payload: Awaited<ReturnType<typeof getPayload>>,
  primaryPath: string,
  fallbackPath: string,
  alt: string,
): Promise<number | null> {
  const primary = await uploadMedia(payload, primaryPath, alt);
  if (primary) return primary;

  const substitute = await uploadMedia(payload, fallbackPath, alt);
  if (substitute) {
    console.warn(`  WARN MISSING ${primaryPath} — substituting ${fallbackPath}`);
    fallbacks.push({ missing: primaryPath, substituted: fallbackPath });
    return substitute;
  }

  console.warn(`  WARN MISSING ${primaryPath} — fallback ${fallbackPath} is missing too`);
  missingEntirely.push(primaryPath);
  return null;
}

async function findOrCreateTag(
  payload: Awaited<ReturnType<typeof getPayload>>,
  label: string,
): Promise<number> {
  const slug = slugify(label);

  const existing = await payload.find({
    collection: "tags",
    where: { slug: { equals: slug } },
    limit: 1,
  });

  if (existing.docs[0]) return existing.docs[0].id;

  const created = await payload.create({
    collection: "tags",
    data: { label: label.trim(), slug },
  });

  return created.id;
}

async function main() {
  const geojsonPath = join(process.cwd(), "data", "textures.geojson");
  const raw = readFileSync(geojsonPath, "utf-8");
  const collection = JSON.parse(raw) as TextureFeatureCollection;
  const features = collection.features as GeoJsonFeature[];

  const payload = await getPayload({ config });

  console.log(`Migrating ${features.length} textures from GeoJSON…`);

  for (const feature of features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const textureId = props.id;

    const existing = await payload.find({
      collection: "textures",
      where: { textureId: { equals: textureId } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      console.log(`skip ${textureId} (already exists)`);
      continue;
    }

    const thumbPath = props.thumbnailUrl ?? `/textures/${textureId}/thumb.png`;
    const previewPath = props.previewUrl ?? `/textures/${textureId}/preview.png`;

    const thumbnailId = await uploadWithFallback(payload, thumbPath, previewPath, `${props.title} thumb`);
    const previewId = await uploadWithFallback(payload, previewPath, thumbPath, `${props.title} preview`);

    if (!thumbnailId || !previewId) {
      console.warn(`skip ${textureId} — missing thumbnail/preview files in public/`);
      continue;
    }

    const sourceAssets =
      props.assets ??
      props.files?.map((file, index) => ({
        id: `${textureId}-file-${index}`,
        label: file.label ?? `${file.format.toUpperCase()} download`,
        description: undefined,
        previewUrl: previewPath,
        format: file.format,
        downloadUrl: file.url,
        sizeBytes: file.sizeBytes,
        dimensions: props.dimensions,
      })) ??
      [];

    const payloadAssets: Array<{
      label: string;
      description?: string;
      format: "png" | "jpg" | "pdf" | "svg" | "webp";
      file: number;
      width?: number;
      height?: number;
    }> = [];

    for (const asset of sourceAssets) {
      const downloadPath = asset.downloadUrl;
      const fileId = await uploadWithFallback(
        payload,
        downloadPath,
        asset.previewUrl || previewPath,
        asset.label,
      );
      if (!fileId) continue;

      payloadAssets.push({
        label: asset.label,
        description: asset.description,
        format: asset.format as "png" | "jpg" | "pdf" | "svg" | "webp",
        file: fileId,
        width: asset.dimensions?.width,
        height: asset.dimensions?.height,
      });
    }

    const tagIds = await Promise.all(props.tags.map((tag) => findOrCreateTag(payload, tag)));

    await payload.create({
      collection: "textures",
      data: {
        textureId,
        slug: props.slug,
        title: props.title,
        description: props.description,
        category: props.category,
        tags: tagIds,
        neighborhood: props.neighborhood,
        address: props.address,
        locationNote: props.locationNote,
        location: { latitude: lat, longitude: lng },
        license: props.license,
        scannedBy: props.scannedBy,
        scannedAt: props.scannedAt,
        dpi: props.dpi,
        markerColor: props.color,
        thumbnail: thumbnailId,
        preview: previewId,
        assets: payloadAssets,
        status: "published",
      },
    });

    console.log(`created ${textureId} (${payloadAssets.length} assets)`);
  }

  await payload.destroy();

  if (fallbacks.length === 0 && missingEntirely.length === 0) {
    console.log("Done — 0 fallbacks.");
    return;
  }

  console.error(
    `\nDone with problems: ${fallbacks.length} substituted, ${missingEntirely.length} unresolvable.`,
  );
  for (const { missing, substituted } of fallbacks) {
    console.error(`  substituted  ${missing}  ->  ${substituted}`);
  }
  for (const missing of missingEntirely) {
    console.error(`  unresolvable ${missing}`);
  }
  console.error("Run `npm run generate:dummy-assets` and re-run this migration.");
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
