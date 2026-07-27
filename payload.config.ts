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

function isR2Configured(): boolean {
  const accessKey = process.env.R2_ACCESS_KEY_ID ?? "";
  return (
    process.env.R2_STORAGE_ENABLED !== "false" &&
    accessKey.length === 32 &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
    Boolean(process.env.R2_BUCKET) &&
    Boolean(process.env.R2_ENDPOINT)
  );
}

const r2Configured = isR2Configured();

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
                prefix: "media",
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
