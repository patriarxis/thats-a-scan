import { existsSync } from "fs";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join, normalize, sep } from "path";
import { Readable } from "stream";
import type { NextRequest } from "next/server";

const MEDIA_ROOT = join(process.cwd(), "media");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".gif": "image/gif",
};

function contentTypeFor(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function resolveMediaPath(segments: string[]): string | null {
  const joined = normalize(segments.join(sep));
  if (joined.startsWith("..")) return null;
  const absolute = join(MEDIA_ROOT, joined);
  if (!absolute.startsWith(MEDIA_ROOT)) return null;
  return absolute;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const filePath = resolveMediaPath(segments);
  if (!filePath || !existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const info = await stat(filePath);
  if (!info.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": contentTypeFor(filePath),
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
