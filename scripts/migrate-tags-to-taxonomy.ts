/**
 * Seeds the Tags taxonomy and links textures from data/textures.geojson.
 * Run after Payload schema sync (tags + textures_rels tables exist).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { getPayload } from "payload";
import config from "../payload.config.ts";

type GeoFeature = {
  properties: {
    id: string;
    tags?: string[];
  };
};

async function findOrCreateTag(
  payload: Awaited<ReturnType<typeof getPayload>>,
  label: string,
): Promise<number> {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
  const payload = await getPayload({ config });
  const geojsonPath = join(process.cwd(), "data", "textures.geojson");
  const collection = JSON.parse(readFileSync(geojsonPath, "utf8")) as {
    features: GeoFeature[];
  };

  let updated = 0;
  let skipped = 0;

  for (const feature of collection.features) {
    const textureId = feature.properties.id;
    const labels = (feature.properties.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (labels.length === 0) {
      skipped += 1;
      continue;
    }

    const existing = await payload.find({
      collection: "textures",
      where: { textureId: { equals: textureId } },
      limit: 1,
      depth: 0,
    });

    const texture = existing.docs[0];
    if (!texture) {
      console.warn(`skip ${textureId}: not in Payload yet`);
      skipped += 1;
      continue;
    }

    const tagIds = await Promise.all(labels.map((label) => findOrCreateTag(payload, label)));

    await payload.update({
      collection: "textures",
      id: texture.id,
      data: { tags: tagIds },
    });

    updated += 1;
    console.log(`linked ${tagIds.length} tags → ${textureId}`);
  }

  console.log(`Done. Updated ${updated} textures (${skipped} skipped).`);
  await payload.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
