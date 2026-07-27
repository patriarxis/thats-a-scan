/**
 * Quick check: Payload DB connection + texture count.
 * Run: npm run payload:check
 */
import { getPayload } from "payload";
import config from "../payload.config.ts";

const payload = await getPayload({ config });

const users = await payload.find({ collection: "users", limit: 1 });
const textures = await payload.find({
  collection: "textures",
  limit: 100,
  depth: 0,
});

console.log(`Users: ${users.totalDocs}`);
console.log(`Textures: ${textures.totalDocs}`);
if (textures.docs.length > 0) {
  for (const doc of textures.docs) {
    console.log(`  - ${doc.textureId} | ${doc.title} | ${doc.status}`);
  }
}

await payload.destroy();
process.exit(0);
