import { MerchantFeature, PartnerFeature } from "@/types";
import { fetchAllVenues } from "./nyamie";

const UP_HELLAS_API_URL = "https://merchants-map.uphellas.gr/geojson/search";

// Greece-wide bounds
const GREECE_BOUNDS = {
  north: 42.16,
  south: 34.24,
  west: 18.85,
  east: 28.75,
};

/**
 * Spatial grid aggregation for heatmap performance.
 * Groups points into cells of `gridSize` degrees and returns cell centers with weights.
 */
export function gridAggregate(
  features: MerchantFeature[],
  gridSize: number = 0.04 // ~4.5km at this latitude, perfect for zoomed-out heatmap
): MerchantFeature[] {
  const grid = new Map<string, { lat: number; lng: number; count: number }>();

  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    // Snapping to grid
    const cellLng = Math.floor(lng / gridSize) * gridSize + gridSize / 2;
    const cellLat = Math.floor(lat / gridSize) * gridSize + gridSize / 2;
    const key = `${cellLat.toFixed(4)}:${cellLng.toFixed(4)}`;

    const existing = grid.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grid.set(key, { lat: cellLat, lng: cellLng, count: 1 });
    }
  }

  return Array.from(grid.values()).map((cell) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [cell.lng, cell.lat],
    },
    properties: {
      count: cell.count,
    },
  }));
}

/**
 * Fetches all merchants from Up Hellas by subdividing the map to bypass API limits.
 */
async function fetchUpHellasAll(): Promise<MerchantFeature[]> {
  const subdivisions = 4; // 4x4 grid = 16 requests
  const latStep = (GREECE_BOUNDS.north - GREECE_BOUNDS.south) / subdivisions;
  const lngStep = (GREECE_BOUNDS.east - GREECE_BOUNDS.west) / subdivisions;

  const requests = [];
  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const nw = {
        latitude: GREECE_BOUNDS.north - i * latStep,
        longitude: GREECE_BOUNDS.west + j * lngStep,
      };
      const se = {
        latitude: GREECE_BOUNDS.north - (i + 1) * latStep,
        longitude: GREECE_BOUNDS.west + (j + 1) * lngStep,
      };
      
      requests.push(
        fetch(UP_HELLAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ north_west: nw, south_east: se }),
        })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data.features) ? data.features : [];
          })
          .catch(() => [])
      );
    }
  }

  const results = await Promise.all(requests);
  const allFeatures = results.flat();
  
  // Deduplicate by MerchantId in case of overlap in subdivisions
  const seen = new Set<string>();
  return allFeatures.filter((f) => {
    const id = f.properties?.ID || f.properties?.MerchantId || `${f.geometry.coordinates}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Combines all sources and returns the aggregated heatmap data.
 */
export async function getHeatmapData(): Promise<MerchantFeature[]> {
  try {
    const [upHellas, nyamie] = await Promise.all([
      fetchUpHellasAll(),
      fetchAllVenues(),
    ]);

    const combined = [...upHellas, ...nyamie];
    console.log(`Heatmap source: ${combined.length} merchants found.`);

    return gridAggregate(combined);
  } catch (error) {
    console.error("Error generating heatmap data:", error);
    return [];
  }
}
