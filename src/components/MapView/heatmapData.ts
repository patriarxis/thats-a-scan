type HeatmapFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    count?: number;
    [key: string]: unknown;
  };
};

export type HeatmapFeatureCollection = {
  type: "FeatureCollection";
  features: HeatmapFeature[];
};

let cachedHeatmap: HeatmapFeatureCollection | null = null;
let heatmapPromise: Promise<HeatmapFeatureCollection> | null = null;

function isHeatmapFeatureCollection(value: unknown): value is HeatmapFeatureCollection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HeatmapFeatureCollection>;
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features);
}

export function loadHeatmapData(): Promise<HeatmapFeatureCollection> {
  if (cachedHeatmap) return Promise.resolve(cachedHeatmap);
  if (heatmapPromise) return heatmapPromise;

  heatmapPromise = fetch("/api/heatmap", {
    headers: { Accept: "application/geo+json, application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load heatmap: ${response.status}`);
      }

      const json: unknown = await response.json();
      if (!isHeatmapFeatureCollection(json)) {
        throw new Error("Heatmap response was not a GeoJSON FeatureCollection");
      }

      cachedHeatmap = json;
      return json;
    })
    .finally(() => {
      heatmapPromise = null;
    });

  return heatmapPromise;
}

export function warmHeatmapData(): void {
  loadHeatmapData().catch((error) => {
    console.error("Failed to warm heatmap data:", error);
  });
}
