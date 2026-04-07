import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type ILocale,
  type MerchantFeature
} from "@/types";

export type MerchantSuggestion = {
  id: string;
  merchantId: string;
  label: string;
  sublabel: string;
  coordinates: [number, number];
};

type IndexEntry = {
  merchantId: string;
  feature: MerchantFeature;
  haystack: string;
};

export function buildSearchIndex(features: MerchantFeature[], locale: ILocale): IndexEntry[] {
  return features.map((feature) => {
    const merchantId = getMerchantId(feature);
    const name = getMerchantName(feature, locale);
    const address = getMerchantAddress(feature, locale);
    return {
      merchantId,
      feature,
      haystack: `${name} ${address}`.toLowerCase()
    };
  });
}

// Module-level cache: reuse the index when features array reference and locale are unchanged.
let cachedIndex: IndexEntry[] | null = null;
let cachedFeatures: MerchantFeature[] | null = null;
let cachedILocale: ILocale | null = null;

function getOrBuildIndex(features: MerchantFeature[], locale: ILocale): IndexEntry[] {
  if (features === cachedFeatures && locale === cachedILocale && cachedIndex !== null) {
    return cachedIndex;
  }
  cachedIndex = buildSearchIndex(features, locale);
  cachedFeatures = features;
  cachedILocale = locale;
  return cachedIndex;
}

export function searchMerchantSuggestions(
  query: string,
  features: MerchantFeature[],
  locale: ILocale,
  limit = 8
): MerchantSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return getOrBuildIndex(features, locale)
    .filter((entry) => entry.haystack.includes(normalized))
    .slice(0, limit)
    .map(({ feature, merchantId }) => ({
      id: `merchant:${merchantId}`,
      merchantId,
      label: getMerchantName(feature, locale),
      sublabel: getMerchantAddress(feature, locale),
      coordinates: feature.geometry.coordinates
    }));
}
