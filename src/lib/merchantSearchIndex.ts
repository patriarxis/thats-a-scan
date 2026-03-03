import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type Locale,
  type MerchantFeature
} from "@/types/merchant";

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

export function buildSearchIndex(features: MerchantFeature[], locale: Locale): IndexEntry[] {
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
let cachedLocale: Locale | null = null;

function getOrBuildIndex(features: MerchantFeature[], locale: Locale): IndexEntry[] {
  if (features === cachedFeatures && locale === cachedLocale && cachedIndex !== null) {
    return cachedIndex;
  }
  cachedIndex = buildSearchIndex(features, locale);
  cachedFeatures = features;
  cachedLocale = locale;
  return cachedIndex;
}

export function searchMerchantSuggestions(
  query: string,
  features: MerchantFeature[],
  locale: Locale,
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
