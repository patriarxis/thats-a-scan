import type { CategoryId, ILocale, MerchantFeature } from "@/types";
import { getMerchantAddress, getMerchantName } from "@/types";
import { normalizeStr } from "@/lib/stringUtils";

export type PopularSearchCategoryId =
  | "supermarket"
  | "restaurant"
  | "coffee"
  | "pharmacy"
  | "bakery"
  | "gym";

export type PopularSearchCategory = {
  id: PopularSearchCategoryId;
  label: string;
  helperText: string;
  keywords: string[];
  mappedNetworkId?: CategoryId;
};

type PopularSearchCategoryDefinition = {
  id: PopularSearchCategoryId;
  labels: Record<ILocale, string>;
  helperText: Record<ILocale, string>;
  keywords: string[];
  mappedNetworkId?: CategoryId;
};

const CATEGORY_DEFINITIONS: PopularSearchCategoryDefinition[] = [
  {
    id: "supermarket",
    labels: { en: "Supermarkets", el: "Σούπερ μάρκετ" },
    helperText: { en: "Groceries and daily essentials", el: "Τρόφιμα και καθημερινά είδη" },
    keywords: ["supermarket", "super market", "grocery", "groceries", "market", "παντοπωλειο", "σουπερ μαρκετ"],
    mappedNetworkId: "meal",
  },
  {
    id: "restaurant",
    labels: { en: "Restaurants", el: "Εστιατόρια" },
    helperText: { en: "Lunch, dinner and dine-in", el: "Φαγητό, δείπνο και dine-in" },
    keywords: ["restaurant", "food", "eat", "dinner", "lunch", "εστιατοριο", "φαγητο", "σουβλακι"],
    mappedNetworkId: "meal",
  },
  {
    id: "coffee",
    labels: { en: "Coffee", el: "Καφές" },
    helperText: { en: "Cafe and coffee spots", el: "Καφετέριες και coffee spots" },
    keywords: ["coffee", "cafe", "café", "espresso", "καφες", "καφε", "καφετερια"],
    mappedNetworkId: "meal",
  },
  {
    id: "pharmacy",
    labels: { en: "Pharmacies", el: "Φαρμακεία" },
    helperText: { en: "Pharmacy and health stores", el: "Φαρμακεία και είδη υγείας" },
    keywords: ["pharmacy", "pharmacies", "drugstore", "health", "φαρμακειο", "φαρμακεια"],
    mappedNetworkId: "rewards",
  },
  {
    id: "bakery",
    labels: { en: "Bakery", el: "Φούρνοι" },
    helperText: { en: "Bread, pastries and snacks", el: "Ψωμί, γλυκά και snacks" },
    keywords: ["bakery", "bakeries", "bread", "pastry", "φουρνος", "αρτοποιειο"],
    mappedNetworkId: "meal",
  },
  {
    id: "gym",
    labels: { en: "Gyms", el: "Γυμναστήρια" },
    helperText: { en: "Fitness and wellness", el: "Fitness και ευεξία" },
    keywords: ["gym", "fitness", "wellness", "pilates", "crossfit", "γυμναστηριο", "γυμναστηρια"],
    mappedNetworkId: "gyms",
  },
];

const getLocaleValue = <T extends string>(byLocale: Record<ILocale, T>, locale: ILocale): T =>
  byLocale[locale] ?? byLocale.en;

export const getPopularSearchCategories = (locale: ILocale): PopularSearchCategory[] =>
  CATEGORY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: getLocaleValue(definition.labels, locale),
    helperText: getLocaleValue(definition.helperText, locale),
    keywords: definition.keywords,
    mappedNetworkId: definition.mappedNetworkId,
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
  const searchText = normalizeStr(
    [
      getMerchantName(merchant, locale),
      getMerchantAddress(merchant, locale),
      merchant.properties.BrandNameGR,
      merchant.properties.BrandNameEN,
      merchant.properties.VATNameGR,
      merchant.properties.VATNameEN,
      merchant.properties.MCCCategoryGR,
      merchant.properties.MCCCategoryEN,
      merchant.properties.AcceptedProducts,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return category.keywords.some((keyword) => searchText.includes(normalizeStr(keyword)));
};
