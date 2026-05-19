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

/** Fast path for bbox APIs: use when snapshot is complete and within hard TTL. */
export function tryGetCachedCompleteSnapshot(): MerchantCatalogueSnapshot | null {
  if (!cachedSnapshot) return null;
  if (ageOf(cachedSnapshot) >= CATALOGUE_TTL_MS) return null;
  if (!cachedSnapshot.upHellas.complete) return null;
  return cachedSnapshot;
}

/** Start full-Greece catalogue build without blocking (deduped with `getCachedMerchantCatalogue`). */
export function kickMerchantCatalogueWarm(): void {
  ensureFetchInFlight().catch(() => undefined);
}

const CATALOGUE_WARM_DELAY_MS = 3000;
let delayedWarmTimer: ReturnType<typeof setTimeout> | null = null;

/** Defer catalogue warm so viewport Up Hellas requests are not competing on a cold instance. */
export function scheduleDelayedMerchantCatalogueWarm(): void {
  if (tryGetCachedCompleteSnapshot()) return;
  if (delayedWarmTimer !== null) return;
  delayedWarmTimer = setTimeout(() => {
    delayedWarmTimer = null;
    kickMerchantCatalogueWarm();
  }, CATALOGUE_WARM_DELAY_MS);
}
