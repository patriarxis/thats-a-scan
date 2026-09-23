/**
 * Generates the dummy texture binaries the catalog references.
 *
 * `data/textures.geojson` is the source of truth: every path named by a
 * feature's `thumbnailUrl`, `previewUrl`, `files[].url` and
 * `assets[].downloadUrl` gets a real file under `public/`, at the dimensions
 * and in the format the manifest declares.
 *
 * Output is deterministic — the pattern is seeded from the asset id — so
 * re-running overwrites with byte-identical files. Actual byte sizes are
 * written back into the manifest's `sizeBytes` so the two can never disagree.
 *
 * Run: npm run generate:dummy-assets
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";

type Dimensions = { width: number; height: number };

type ManifestAsset = {
  id: string;
  label: string;
  previewUrl?: string;
  format: string;
  downloadUrl: string;
  sizeBytes?: number;
  dimensions?: Dimensions;
};

type ManifestFile = {
  format: string;
  url: string;
  sizeBytes?: number;
  label?: string;
};

type ManifestFeature = {
  properties: {
    id: string;
    title: string;
    category: string;
    color?: string;
    dimensions?: Dimensions;
    thumbnailUrl?: string;
    previewUrl?: string;
    files?: ManifestFile[];
    assets?: ManifestAsset[];
  };
};

type Manifest = { features: ManifestFeature[] };

/** One file to write. */
type Target = {
  /** Public path, e.g. `/textures/tex_001/full.png`. */
  urlPath: string;
  /** Drives both the pattern choice and the PRNG — per asset, not per texture. */
  seed: string;
  label: string;
  baseColor: string;
  width: number;
  height: number;
  format: "png" | "jpg" | "pdf";
};

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "data", "textures.geojson");
const PUBLIC_DIR = join(ROOT, "public");

const THUMB_SIZE: Dimensions = { width: 400, height: 400 };
const PREVIEW_SIZE: Dimensions = { width: 1200, height: 900 };
/** Source the thumb and preview are both derived from, so they stay related. */
const SOURCE_SIZE: Dimensions = { width: 1600, height: 1200 };

const DEFAULT_DIMENSIONS: Dimensions = { width: 2000, height: 1500 };
const PATTERNS = ["noise", "stripes", "concentric", "grain", "blocks"] as const;
type Pattern = (typeof PATTERNS)[number];

// ── deterministic randomness ────────────────────────────────────────────────

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, fully determined by the seed. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── colour ──────────────────────────────────────────────────────────────────

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 1) + 1) % 1;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hue + 1 / 3) * 255),
    g: Math.round(channel(hue) * 255),
    b: Math.round(channel(hue - 1 / 3) * 255),
  };
}

// ── pattern synthesis ───────────────────────────────────────────────────────

/** Cheap value noise: a coarse lattice sampled with smooth interpolation. */
function makeValueNoise(random: () => number, size: number): (x: number, y: number) => number {
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = random();

  const at = (ix: number, iy: number) => lattice[(iy % size) * size + (ix % size)]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const ix = ((x0 % size) + size) % size;
    const iy = ((y0 % size) + size) % size;
    const top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
    const bottom = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/**
 * Renders one RGB buffer. Hue comes from the texture's marker colour, the
 * pattern family and all its parameters from the seed, so two assets of the
 * same texture are recognisably siblings but never the same image.
 */
function renderPattern(target: Target): Buffer {
  const { width, height, seed, baseColor } = target;
  const seedHash = hashString(seed);
  const random = makeRandom(seedHash);
  const pattern: Pattern = PATTERNS[seedHash % PATTERNS.length]!;

  const [baseH, baseS, baseL] = rgbToHsl(hexToRgb(baseColor));
  // Nudge hue per asset so siblings read as variants of one palette.
  const hue = baseH + (random() - 0.5) * 0.08;
  const sat = Math.min(0.95, Math.max(0.12, baseS * (0.7 + random() * 0.6)));

  const noise = makeValueNoise(random, 64);
  const grain = makeValueNoise(random, 256);

  const scale = 1 / (24 + random() * 40);
  const stripeAngle = random() * Math.PI;
  const stripePeriod = 18 + random() * 90;
  const ringSpacing = 20 + random() * 70;
  const blockSize = Math.max(8, Math.round(width / (10 + Math.floor(random() * 26))));
  const cx = width * (0.3 + random() * 0.4);
  const cy = height * (0.3 + random() * 0.4);
  const cosA = Math.cos(stripeAngle);
  const sinA = Math.sin(stripeAngle);

  const buffer = Buffer.allocUnsafe(width * height * 3);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Two octaves of value noise underlie every family — that is what makes
      // the output compress like a photo instead of like white noise.
      const n =
        noise(x * scale, y * scale) * 0.65 + noise(x * scale * 3.1, y * scale * 3.1) * 0.35;

      let v: number;
      switch (pattern) {
        case "stripes": {
          const p = (x * cosA + y * sinA) / stripePeriod;
          v = 0.5 + 0.34 * Math.sin(p * Math.PI * 2 + n * 3.4) + (n - 0.5) * 0.3;
          break;
        }
        case "concentric": {
          const d = Math.hypot(x - cx, y - cy) / ringSpacing;
          v = 0.5 + 0.3 * Math.sin(d * Math.PI * 2 + n * 2.2) + (n - 0.5) * 0.36;
          break;
        }
        case "blocks": {
          const bx = Math.floor(x / blockSize);
          const by = Math.floor(y / blockSize);
          const cell = ((hashString(`${bx}:${by}:${seed}`) >>> 8) % 1000) / 1000;
          v = cell * 0.55 + n * 0.45;
          break;
        }
        case "grain": {
          v = n * 0.55 + grain(x * 0.45, y * 0.45) * 0.45;
          break;
        }
        case "noise":
        default: {
          v = n;
          break;
        }
      }

      if (v < 0) v = 0;
      else if (v > 1) v = 1;

      // Light-on-dark and dark-on-light both occur in the real catalog; keep the
      // lightness band centred on the marker colour so pins stay recognisable.
      const l = Math.min(0.94, Math.max(0.06, baseL * 0.45 + 0.18 + v * 0.55));
      const { r, g, b } = hslToRgb(hue + (v - 0.5) * 0.05, sat, l);
      buffer[offset] = r;
      buffer[offset + 1] = g;
      buffer[offset + 2] = b;
      offset += 3;
    }
  }

  return buffer;
}

// ── label stamp ─────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stamps the asset label and pixel dimensions into the bottom-left corner. */
function labelOverlay(target: Target): { input: Buffer; top: number; left: number } | null {
  const { width, height, label } = target;
  const pad = Math.max(8, Math.round(width * 0.012));
  const fontSize = Math.max(11, Math.round(width * 0.022));
  const lineGap = Math.round(fontSize * 0.45);
  const boxHeight = fontSize * 2 + lineGap + pad * 2;
  const boxWidth = Math.min(
    width - pad * 2,
    Math.round(Math.max(label.length, 18) * fontSize * 0.58) + pad * 2,
  );
  if (boxHeight + pad > height || boxWidth <= 0) return null;

  const dims = `${width} × ${height} px`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}">
  <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(fontSize * 0.3)}" fill="#0b0b0c" fill-opacity="0.72"/>
  <text x="${pad}" y="${pad + fontSize}" font-family="DejaVu Sans, Verdana, Arial, sans-serif" font-size="${fontSize}" fill="#ffffff">${escapeXml(label)}</text>
  <text x="${pad}" y="${pad + fontSize * 2 + lineGap}" font-family="DejaVu Sans, Verdana, Arial, sans-serif" font-size="${Math.round(fontSize * 0.8)}" fill="#c9c9cc">${escapeXml(dims)}</text>
</svg>`;

  return {
    input: Buffer.from(svg),
    top: height - boxHeight - pad,
    left: pad,
  };
}

// ── encoders ────────────────────────────────────────────────────────────────

async function encodeRaster(target: Target, raw: Buffer): Promise<Buffer> {
  let pipeline = sharp(raw, {
    raw: { width: target.width, height: target.height, channels: 3 },
  });

  const overlay = labelOverlay(target);
  if (overlay) pipeline = pipeline.composite([overlay]);

  if (target.format === "jpg") {
    return pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: false }).toBuffer();
  }
  return pipeline.png({ compressionLevel: 9, effort: 7 }).toBuffer();
}

/**
 * Minimal single-page PDF wrapping a JPEG as a DCTDecode image XObject. Avoids
 * pulling in a PDF library for what is ultimately a fixture.
 */
function buildPdf(jpeg: Buffer, width: number, height: number): Buffer {
  // 72pt/inch at 150 DPI keeps the page a plausible print size.
  const pageW = Math.round((width / 150) * 72);
  const pageH = Math.round((height / 150) * 72);

  const objects: Buffer[] = [];
  const push = (body: string | Buffer) =>
    objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);

  push("<< /Type /Catalog /Pages 2 0 R >>");
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );

  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q\n`;
  push(Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
    Buffer.from(content, "latin1"),
    Buffer.from("\nendstream", "latin1"),
  ]));

  push(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n` +
          `stream\n`,
        "latin1",
      ),
      jpeg,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [];
  let position = chunks[0]!.length;

  objects.forEach((body, index) => {
    offsets.push(position);
    const head = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    const chunk = Buffer.concat([head, body, tail]);
    chunks.push(chunk);
    position += chunk.length;
  });

  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}

// ── target collection ───────────────────────────────────────────────────────

function normalizeFormat(raw: string, urlPath: string): Target["format"] {
  const fromPath = urlPath.split(".").pop()?.toLowerCase();
  const value = (fromPath || raw).toLowerCase();
  if (value === "jpg" || value === "jpeg") return "jpg";
  if (value === "pdf") return "pdf";
  return "png";
}

function collectTargets(manifest: Manifest): Target[] {
  const byPath = new Map<string, Target>();

  const add = (target: Target) => {
    const existing = byPath.get(target.urlPath);
    if (!existing) {
      byPath.set(target.urlPath, target);
      return;
    }
    // Two manifest entries naming one path: keep the larger declared size so the
    // file satisfies both.
    if (target.width * target.height > existing.width * existing.height) {
      byPath.set(target.urlPath, target);
    }
  };

  for (const feature of manifest.features) {
    const p = feature.properties;
    const color = p.color ?? "#8a8a8a";
    const base = p.dimensions ?? DEFAULT_DIMENSIONS;

    if (p.thumbnailUrl) {
      add({
        urlPath: p.thumbnailUrl,
        seed: `${p.id}:source`,
        label: `${p.title} — thumb`,
        baseColor: color,
        ...THUMB_SIZE,
        format: normalizeFormat("png", p.thumbnailUrl),
      });
    }

    if (p.previewUrl) {
      add({
        urlPath: p.previewUrl,
        seed: `${p.id}:source`,
        label: `${p.title} — preview`,
        baseColor: color,
        ...PREVIEW_SIZE,
        format: normalizeFormat("png", p.previewUrl),
      });
    }

    for (const [index, file] of (p.files ?? []).entries()) {
      add({
        urlPath: file.url,
        seed: `${p.id}:file:${index}:${file.url}`,
        label: file.label ?? `${p.title} — ${file.format.toUpperCase()}`,
        baseColor: color,
        width: base.width,
        height: base.height,
        format: normalizeFormat(file.format, file.url),
      });
    }

    for (const asset of p.assets ?? []) {
      const dims = asset.dimensions ?? base;
      add({
        urlPath: asset.downloadUrl,
        // Seeded from the asset id, so sibling assets never render alike.
        seed: asset.id,
        label: asset.label,
        baseColor: color,
        width: dims.width,
        height: dims.height,
        format: normalizeFormat(asset.format, asset.downloadUrl),
      });
    }
  }

  return [...byPath.values()].sort((a, b) => a.urlPath.localeCompare(b.urlPath));
}

// ── writing ─────────────────────────────────────────────────────────────────

function publicPathFor(urlPath: string): string {
  return join(PUBLIC_DIR, urlPath.replace(/^\//, ""));
}

async function writeTarget(target: Target): Promise<number> {
  const absolute = publicPathFor(target.urlPath);
  mkdirSync(dirname(absolute), { recursive: true });

  if (target.format === "pdf") {
    const raw = renderPattern(target);
    const jpeg = await encodeRaster({ ...target, format: "jpg" }, raw);
    writeFileSync(absolute, buildPdf(jpeg, target.width, target.height));
  } else if (
    target.urlPath.endsWith("/thumb.png") ||
    target.urlPath.endsWith("/preview.png")
  ) {
    // Both derive from one source render, so they look like the same texture at
    // two sizes rather than two unrelated images.
    const source = renderPattern({ ...target, ...SOURCE_SIZE });
    const resized = await sharp(source, {
      raw: { width: SOURCE_SIZE.width, height: SOURCE_SIZE.height, channels: 3 },
    })
      .resize(target.width, target.height, { fit: "cover" })
      .raw()
      .toBuffer();
    writeFileSync(absolute, await encodeRaster(target, resized));
  } else {
    writeFileSync(absolute, await encodeRaster(target, renderPattern(target)));
  }

  return statSync(absolute).size;
}

/** Keeps the manifest's declared `sizeBytes` equal to what we actually wrote. */
function syncManifestSizes(manifest: Manifest, sizes: Map<string, number>): number {
  let changed = 0;

  for (const feature of manifest.features) {
    const p = feature.properties;
    for (const file of p.files ?? []) {
      const actual = sizes.get(file.url);
      if (actual !== undefined && file.sizeBytes !== actual) {
        file.sizeBytes = actual;
        changed += 1;
      }
    }
    for (const asset of p.assets ?? []) {
      const actual = sizes.get(asset.downloadUrl);
      if (actual !== undefined && asset.sizeBytes !== actual) {
        asset.sizeBytes = actual;
        changed += 1;
      }
    }
  }

  return changed;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
  const targets = collectTargets(manifest);

  console.log(`Generating ${targets.length} dummy assets from data/textures.geojson…`);

  const sizes = new Map<string, number>();
  for (const target of targets) {
    const bytes = await writeTarget(target);
    sizes.set(target.urlPath, bytes);
    console.log(
      `  ${target.urlPath.padEnd(40)} ${String(target.width).padStart(4)}×${String(
        target.height,
      ).padEnd(5)} ${formatBytes(bytes).padStart(9)}`,
    );
  }

  const changed = syncManifestSizes(manifest, sizes);
  if (changed > 0) {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Updated ${changed} sizeBytes value(s) in data/textures.geojson.`);
  } else {
    console.log("Manifest sizeBytes already match the generated files.");
  }

  const total = [...sizes.values()].reduce((sum, n) => sum + n, 0);
  console.log(`Done — ${targets.length} files, ${formatBytes(total)} total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
