import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://merchants-map.uphellas.gr/geojson/search";
const DEFAULT_OUT_DIR = "exports/up-hellas";
const DEFAULT_BOUNDS = {
  north: 42.2,
  west: 18.5,
  south: 34.5,
  east: 30.5,
};

const CSV_COLUMNS = [
  "ID",
  "mongo_id",
  "VATNumber",
  "BrandName_GR",
  "BrandName_EN",
  "VATName_GR",
  "VATName_EN",
  "AcceptedProducts",
  "MCCCategory_GR",
  "MCCCategory_EN",
  "Address_GR",
  "Address_EN",
  "Town_GR",
  "Town_EN",
  "District_GR",
  "District_EN",
  "Region_GR",
  "Region_EN",
  "ZIPCode",
  "CoordinatesAccuracy",
  "longitude",
  "latitude",
];

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const outDir = path.resolve(process.cwd(), args.out ?? DEFAULT_OUT_DIR);
const maxDepth = Number(args.maxDepth ?? 8);
const cap = Number(args.cap ?? 2000);
const concurrency = Number(args.concurrency ?? 6);
const bounds = parseBounds(args.bounds) ?? DEFAULT_BOUNDS;

if (args.search) {
  await searchExport(outDir, args.search, Number(args.limit ?? 25));
} else {
  await exportData({ outDir, bounds, cap, maxDepth, concurrency });
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Export all merchants visible through the Up Hellas GeoJSON API.

Usage:
  npm run export:up-hellas
  node scripts/export-up-hellas-data.mjs --out exports/up-hellas
  node scripts/export-up-hellas-data.mjs --search "merchant name or VAT"

Options:
  --out <dir>             Output directory. Default: ${DEFAULT_OUT_DIR}
  --bounds <n,w,s,e>      Export bounds. Default covers Greece.
  --cap <number>          API result cap per box. Default: 2000
  --maxDepth <number>     Recursive split depth for capped boxes. Default: 8
  --concurrency <number>  Parallel API requests. Default: 6
  --search <text>         Search an existing export instead of exporting.
  --limit <number>        Search result limit. Default: 25
`);
}

function parseBounds(value) {
  if (!value) return null;
  const parts = String(value).split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("--bounds must be four comma-separated numbers: north,west,south,east");
  }
  const [north, west, south, east] = parts;
  if (north <= south || west >= east) {
    throw new Error("--bounds must be ordered as north,west,south,east");
  }
  return { north, west, south, east };
}

async function exportData({ outDir, bounds, cap, maxDepth, concurrency }) {
  await mkdir(outDir, { recursive: true });

  const state = {
    queue: [{ bounds, depth: 0 }],
    featuresByKey: new Map(),
    saturatedBounds: [],
    requestCount: 0,
    failedBounds: [],
  };

  console.log("Exporting Up Hellas merchants...");
  console.log(`Output: ${outDir}`);
  console.log(
    `Bounds: north=${bounds.north}, west=${bounds.west}, south=${bounds.south}, east=${bounds.east}`,
  );

  await runQueue(state, { cap, maxDepth, concurrency });

  const features = Array.from(state.featuresByKey.values()).sort(compareFeatures);
  const featureCollection = { type: "FeatureCollection", features };
  const summary = buildSummary(features, state, { bounds, cap, maxDepth });

  await writeFile(
    path.join(outDir, "up-hellas-raw.geojson"),
    `${JSON.stringify(featureCollection, null, 2)}\n`,
  );
  await writeFile(path.join(outDir, "up-hellas-merchants.csv"), toCsv(features));
  await writeFile(
    path.join(outDir, "up-hellas-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeFile(
    path.join(outDir, "up-hellas-saturated-bounds.json"),
    `${JSON.stringify(state.saturatedBounds, null, 2)}\n`,
  );

  console.log(`Done. Unique merchants: ${features.length}`);
  console.log(`API requests: ${state.requestCount}`);
  console.log(`Saturated boxes: ${state.saturatedBounds.length}`);
  console.log(`Failed boxes: ${state.failedBounds.length}`);
  console.log(`Files written:
  ${path.join(outDir, "up-hellas-raw.geojson")}
  ${path.join(outDir, "up-hellas-merchants.csv")}
  ${path.join(outDir, "up-hellas-summary.json")}
  ${path.join(outDir, "up-hellas-saturated-bounds.json")}`);
}

async function runQueue(state, { cap, maxDepth, concurrency }) {
  let active = 0;

  await new Promise((resolve) => {
    const pump = () => {
      while (active < concurrency && state.queue.length > 0) {
        const item = state.queue.shift();
        active += 1;
        processBounds(item, state, { cap, maxDepth })
          .catch((error) => {
            state.failedBounds.push({ ...item, error: String(error?.message ?? error) });
          })
          .finally(() => {
            active -= 1;
            if (state.queue.length === 0 && active === 0) {
              resolve();
            } else {
              pump();
            }
          });
      }
    };
    pump();
  });
}

async function processBounds(item, state, { cap, maxDepth }) {
  const response = await fetchBounds(item.bounds);
  state.requestCount += 1;

  for (const feature of response.features) {
    state.featuresByKey.set(featureKey(feature), feature);
  }

  const isProbablyCapped = response.features.length >= cap;
  if (isProbablyCapped && item.depth < maxDepth) {
    for (const childBounds of splitBounds(item.bounds)) {
      state.queue.push({ bounds: childBounds, depth: item.depth + 1 });
    }
  } else if (isProbablyCapped) {
    state.saturatedBounds.push({
      bounds: item.bounds,
      depth: item.depth,
      featureCount: response.features.length,
    });
  }

  if (state.requestCount % 25 === 0) {
    console.log(
      `Requests: ${state.requestCount}, unique merchants: ${state.featuresByKey.size}, queue: ${state.queue.length}`,
    );
  }
}

async function fetchBounds(bounds) {
  const payload = {
    north_west: { latitude: bounds.north, longitude: bounds.west },
    south_east: { latitude: bounds.south, longitude: bounds.east },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Up Hellas API returned ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return {
    type: json?.type,
    features: Array.isArray(json?.features) ? json.features : [],
  };
}

function splitBounds(bounds) {
  const midLat = (bounds.north + bounds.south) / 2;
  const midLng = (bounds.west + bounds.east) / 2;
  return [
    { north: bounds.north, west: bounds.west, south: midLat, east: midLng },
    { north: bounds.north, west: midLng, south: midLat, east: bounds.east },
    { north: midLat, west: bounds.west, south: bounds.south, east: midLng },
    { north: midLat, west: midLng, south: bounds.south, east: bounds.east },
  ];
}

function featureKey(feature) {
  const props = feature?.properties ?? {};
  const coords = feature?.geometry?.coordinates ?? [];
  return String(
    props.mongo_id ??
      props.ID ??
      props.VATNumber ??
      `${coords[0] ?? ""}:${coords[1] ?? ""}:${props.BrandName_GR ?? props.BrandName_EN ?? ""}`,
  );
}

function compareFeatures(a, b) {
  const aName = String(a?.properties?.BrandName_GR ?? a?.properties?.BrandName_EN ?? "");
  const bName = String(b?.properties?.BrandName_GR ?? b?.properties?.BrandName_EN ?? "");
  return aName.localeCompare(bName, "el");
}

function buildSummary(features, state, options) {
  const products = new Map();
  const categories = new Map();
  const regions = new Map();

  for (const feature of features) {
    const props = feature.properties ?? {};
    for (const product of Array.isArray(props.AcceptedProducts) ? props.AcceptedProducts : []) {
      increment(products, product);
    }
    increment(categories, props.MCCCategory_GR ?? props.MCCCategory_EN ?? "");
    increment(regions, props.Region_GR ?? props.Region_EN ?? "");
  }

  return {
    exportedAt: new Date().toISOString(),
    apiUrl: API_URL,
    totalUniqueMerchants: features.length,
    requestCount: state.requestCount,
    saturatedBoundsCount: state.saturatedBounds.length,
    failedBoundsCount: state.failedBounds.length,
    options,
    counts: {
      products: sortedCounts(products),
      categories: sortedCounts(categories),
      regions: sortedCounts(regions),
    },
    failedBounds: state.failedBounds,
  };
}

function increment(map, key) {
  const normalizedKey = String(key ?? "").trim() || "(blank)";
  map.set(normalizedKey, (map.get(normalizedKey) ?? 0) + 1);
}

function sortedCounts(map) {
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function toCsv(features) {
  const rows = [CSV_COLUMNS.join(",")];
  for (const feature of features) {
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates ?? [];
    const row = CSV_COLUMNS.map((column) => {
      if (column === "longitude") return csvCell(coords[0]);
      if (column === "latitude") return csvCell(coords[1]);
      return csvCell(props[column]);
    });
    rows.push(row.join(","));
  }
  return `${rows.join("\n")}\n`;
}

function csvCell(value) {
  const stringValue = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

async function searchExport(outDir, query, limit) {
  const geojsonPath = path.join(outDir, "up-hellas-raw.geojson");
  const raw = await readFile(geojsonPath, "utf8").catch(() => null);
  if (!raw) {
    throw new Error(`No export found at ${geojsonPath}. Run npm run export:up-hellas first.`);
  }

  const data = JSON.parse(raw);
  const features = Array.isArray(data.features) ? data.features : [];
  const normalizedQuery = normalizeForSearch(query);
  const words = normalizedQuery.split(" ").filter(Boolean);

  const matches = features
    .map((feature) => {
      const haystack = searchableText(feature);
      const normalizedHaystack = normalizeForSearch(haystack);
      const score = scoreMatch(normalizedHaystack, normalizedQuery, words);
      return { feature, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (matches.length === 0) {
    console.log(`No matches found for "${query}".`);
    console.log("If the spelling is uncertain, try VAT number, town, street, or a shorter name fragment.");
    return;
  }

  console.log(`Top ${matches.length} matches for "${query}":`);
  for (const { feature, score } of matches) {
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates ?? [];
    console.log(
      [
        `score=${score}`,
        `ID=${props.ID ?? ""}`,
        `VAT=${props.VATNumber ?? ""}`,
        `name=${props.BrandName_GR ?? props.BrandName_EN ?? props.VATName_GR ?? props.VATName_EN ?? ""}`,
        `address=${[props.Address_GR, props.Town_GR, props.Region_GR, props.ZIPCode].filter(Boolean).join(", ")}`,
        `category=${props.MCCCategory_GR ?? props.MCCCategory_EN ?? ""}`,
        `products=${Array.isArray(props.AcceptedProducts) ? props.AcceptedProducts.join("; ") : ""}`,
        `coords=${coords.join(",")}`,
      ].join(" | "),
    );
  }
}

function searchableText(feature) {
  const props = feature.properties ?? {};
  return [
    props.ID,
    props.mongo_id,
    props.VATNumber,
    props.BrandName_GR,
    props.BrandName_EN,
    props.VATName_GR,
    props.VATName_EN,
    props.Address_GR,
    props.Address_EN,
    props.Town_GR,
    props.Town_EN,
    props.District_GR,
    props.District_EN,
    props.Region_GR,
    props.Region_EN,
    props.ZIPCode,
    props.MCCCategory_GR,
    props.MCCCategory_EN,
    Array.isArray(props.AcceptedProducts) ? props.AcceptedProducts.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeForSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("el-GR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function scoreMatch(haystack, query, words) {
  if (!query) return 0;
  if (haystack === query) return 100;
  if (haystack.includes(query)) return 60 + Math.min(query.length, 30);

  let score = 0;
  for (const word of words) {
    if (word.length >= 2 && haystack.includes(word)) {
      score += Math.min(word.length, 20);
    }
  }
  return score;
}
