import path from "path";
import { fileURLToPath } from "url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Media } from "./src/payload/collections/Media.ts";
import { Tags } from "./src/payload/collections/Tags.ts";
import { Textures } from "./src/payload/collections/Textures.ts";
import { Users } from "./src/payload/collections/Users.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/** Must stay in sync with the `prefix` passed to `s3Storage` below. */
const R2_MEDIA_PREFIX = "media";

function isR2Configured(): boolean {
  const accessKey = process.env.R2_ACCESS_KEY_ID ?? "";
  return (
    process.env.R2_STORAGE_ENABLED !== "false" &&
    accessKey.length === 32 &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
    Boolean(process.env.R2_BUCKET) &&
    Boolean(process.env.R2_ENDPOINT) &&
    // Without a public base URL the default `generateURL` emits the SigV4 S3 API
    // host, which 403s for anonymous browser requests. Fall back to local
    // storage rather than serving links nothing can load.
    Boolean(process.env.R2_PUBLIC_URL)
  );
}

const r2Configured = isR2Configured();

/**
 * R2's S3 API endpoint is not publicly readable, so build URLs against the
 * public bucket / custom domain instead of letting the plugin default to
 * `${R2_ENDPOINT}/${bucket}/${prefix}/${filename}`.
 */
function generateR2FileURL({
  filename,
  prefix,
}: {
  filename: string;
  prefix?: string;
}): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const dir = (prefix ?? R2_MEDIA_PREFIX).replace(/^\/+|\/+$/g, "");
  const encoded = encodeURIComponent(filename);
  return dir ? `${base}/${dir}/${encoded}` : `${base}/${encoded}`;
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname, "src"),
    },
  },
  collections: [Users, Media, Tags, Textures],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "dev-only-change-me",
  typescript: {
    outputFile: path.resolve(dirname, "src/payload/payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
  sharp,
  plugins: [
    ...(r2Configured
      ? [
          s3Storage({
            collections: {
              media: {
                prefix: R2_MEDIA_PREFIX,
                generateFileURL: generateR2FileURL,
              },
            },
            bucket: process.env.R2_BUCKET!,
            config: {
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
              },
              region: "auto",
              endpoint: process.env.R2_ENDPOINT,
              forcePathStyle: true,
            },
          }),
        ]
      : []),
  ],
});
