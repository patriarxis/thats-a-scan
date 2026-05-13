import { fetchAllVenues } from "@/lib/nyamie";
import {
  fetchAllUpHellasFeatures,
  GREECE_UP_HELLAS_BOUNDS,
  type UpHellasFetchResult,
} from "@/lib/upHellasMerchants";
import type { PartnerFeature } from "@/types";

/** Hard expiry: callers will fall back to a fresh fetch beyond this. */
const CATALOGUE_TTL_MS = 60 * 60 * 1000;

/** Soft threshold: once the snapshot is older than this, return it but trigger a background refresh. */
const SOFT_REFRESH_AFTER_MS = 30 * 60 * 1000;

export type MerchantCatalogueSnapshot = {
  upHellas: UpHellasFetchResult;
  nyamie: PartnerFeature[];
  loadedAt: number;
};

let cachedSnapshot: MerchantCatalogueSnapshot | null = null;
let pendingFetch: Promise<MerchantCatalogueSnapshot> | null = null;

function ageOf(snapshot: MerchantCatalogueSnapshot | null): number {
  if (!snapshot) return Number.POSITIVE_INFINITY;
  return Date.now() - snapshot.loadedAt;
}

async function loadFreshSnapshot(): Promise<MerchantCatalogueSnapshot> {
  const [upHellas, nyamie] = await Promise.all([
    fetchAllUpHellasFeatures(GREECE_UP_HELLAS_BOUNDS).catch((err) => {
      console.error("merchantCatalogueCache: Up Hellas fetch failed:", err);
      return {
        features: [] as PartnerFeature[],
        requestCount: 0,
        saturatedBoundsCount: 0,
        stoppedByRequestLimit: false,
        complete: false,
      } satisfies UpHellasFetchResult;
    }),
    fetchAllVenues().catch((err) => {
      console.error("merchantCatalogueCache: Nyamie fetch failed:", err);
      return [] as PartnerFeature[];
    }),
  ]);

  return {
    upHellas,
    nyamie,
    loadedAt: Date.now(),
  };
}

/** Single in-flight fetch; subsequent callers share the same promise until it settles. */
function ensureFetchInFlight(): Promise<MerchantCatalogueSnapshot> {
  if (!pendingFetch) {
    pendingFetch = loadFreshSnapshot()
      .then((next) => {
        if (next.upHellas.complete) {
          cachedSnapshot = next;
        }
        return next;
      })
      .finally(() => {
        pendingFetch = null;
      });
  }
  return pendingFetch;
}

function kickBackgroundRefresh(): void {
  ensureFetchInFlight().catch((err) => {
    console.error("merchantCatalogueCache: background refresh failed:", err);
  });
}

/**
 * Returns the shared all-Greece snapshot of Up Hellas + Nyamie merchants.
 * - Within `SOFT_REFRESH_AFTER_MS`: cached snapshot served immediately.
 * - Between soft and hard TTL: cached snapshot served, background refresh kicked.
 * - Beyond hard TTL or on cold start: await a fresh load (deduped across concurrent callers).
 * - Incomplete Up Hellas results are never stored; the previous cache (if any) is preserved.
 */
export async function getCachedMerchantCatalogue(): Promise<MerchantCatalogueSnapshot> {
  const ageMs = ageOf(cachedSnapshot);
  if (cachedSnapshot && ageMs < CATALOGUE_TTL_MS) {
    if (ageMs >= SOFT_REFRESH_AFTER_MS) {
      kickBackgroundRefresh();
    }
    return cachedSnapshot;
  }

  const fresh = await ensureFetchInFlight();
  if (fresh.upHellas.complete) return fresh;
  if (cachedSnapshot) return cachedSnapshot;
  return fresh;
}

/** Convenience for callers that only need the Up Hellas slice (e.g. nationwide search). */
export async function getCachedUpHellasResult(): Promise<UpHellasFetchResult> {
  const snapshot = await getCachedMerchantCatalogue();
  return snapshot.upHellas;
}

if (
  typeof process !== "undefined" &&
  process.env.NEXT_RUNTIME === "nodejs" &&
  process.env.NODE_ENV !== "test"
) {
  setTimeout(() => {
    getCachedMerchantCatalogue().catch(() => undefined);
  }, 0);
}
