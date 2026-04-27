import type { CategoryId, ILocale, MerchantFeature } from "@/types";
import { normalizeStr } from "@/lib/stringUtils";
import {
  MERCHANT_CATEGORY_DEFINITIONS,
  getMerchantCategoryHelperText,
  getMerchantCategoryIcon,
  getMerchantCategoryLabel,
  merchantCategorizationIncludes,
  resolveMerchantCategorization,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";
import { ICONS } from "@/enums";

export type PopularSearchCategoryId = MerchantCategoryId;

export type PopularSearchCategory = {
  id: PopularSearchCategoryId;
  label: string;
  helperText: string;
  keywords: string[];
  icon: ICONS;
  mappedNetworkId?: CategoryId;
};

export const getPopularSearchCategories = (locale: ILocale): PopularSearchCategory[] =>
  MERCHANT_CATEGORY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: getMerchantCategoryLabel(definition.id, locale),
    helperText: getMerchantCategoryHelperText(definition.id, locale),
    keywords: definition.aliases,
    icon: getMerchantCategoryIcon(definition.id),
    mappedNetworkId: definition.networkCategoryId,
  }));

export const findPopularCategoriesForQuery = (
  query: string,
  locale: ILocale,
  limit = 3,
): PopularSearchCategory[] => {
  const normalizedQuery = normalizeStr(query.trim());
  if (!normalizedQuery) return [];

  const categories = getPopularSearchCategories(locale);
  return categories
    .map((category) => {
      const normalizedLabel = normalizeStr(category.label);
      const normalizedKeywords = category.keywords.map((keyword) => normalizeStr(keyword));
      let score = 0;
      if (normalizedLabel.startsWith(normalizedQuery)) score = 110;
      else if (normalizedKeywords.some((keyword) => keyword.startsWith(normalizedQuery))) score = 100;
      else if (normalizedLabel.includes(normalizedQuery)) score = 85;
      else if (normalizedKeywords.some((keyword) => keyword.includes(normalizedQuery))) score = 70;
      return { category, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.category);
};

export const merchantMatchesPopularCategory = (
  merchant: MerchantFeature,
  category: PopularSearchCategory,
  locale: ILocale,
): boolean => {
  void locale;
  return merchantCategorizationIncludes(
    resolveMerchantCategorization(merchant.properties),
    category.id,
  );
};
