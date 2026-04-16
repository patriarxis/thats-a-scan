import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type ILocale,
  type MerchantFeature
} from "@/types";
import { normalizeStr } from "./stringUtils";

export type MerchantSuggestion = {
  id: string;
  merchantId: string;
  label: string;
  sublabel: string;
  coordinates: [number, number];
  score?: number;
};

type IndexEntry = {
  merchantId: string;
  feature: MerchantFeature;
  normalizedLabel: string;
  normalizedSublabel: string;
};

export function buildSearchIndex(features: MerchantFeature[], locale: ILocale): IndexEntry[] {
  return features.map((feature) => {
    const merchantId = getMerchantId(feature);
    const name = getMerchantName(feature, locale);
    const address = getMerchantAddress(feature, locale);
    return {
      merchantId,
      feature,
      normalizedLabel: normalizeStr(name),
      normalizedSublabel: normalizeStr(address)
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
  const normalizedQuery = normalizeStr(query.trim());
  if (!normalizedQuery) return [];

  const index = getOrBuildIndex(features, locale);
  const matches: MerchantSuggestion[] = [];

  for (const entry of index) {
    let score = 0;

    if (entry.normalizedLabel.startsWith(normalizedQuery)) {
      score = 100;
    } else if (entry.normalizedLabel.includes(normalizedQuery)) {
      score = 75;
    } else if (entry.normalizedSublabel.startsWith(normalizedQuery)) {
      score = 50;
    } else if (entry.normalizedSublabel.includes(normalizedQuery)) {
      score = 25;
    }

    if (score > 0) {
      matches.push({
        id: `merchant:${entry.merchantId}`,
        merchantId: entry.merchantId,
        label: getMerchantName(entry.feature, locale),
        sublabel: getMerchantAddress(entry.feature, locale),
        coordinates: entry.feature.geometry.coordinates,
        score
      });
    }
  }

  // Sort by score descending
  return matches
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}
