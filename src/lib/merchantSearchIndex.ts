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

export function buildSearchIndex(features: MerchantFeature[], locale: Locale) {
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

export function searchMerchantSuggestions(
  query: string,
  features: MerchantFeature[],
  locale: Locale,
  limit = 8
): MerchantSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return buildSearchIndex(features, locale)
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
