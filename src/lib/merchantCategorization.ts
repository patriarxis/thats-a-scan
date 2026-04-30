import { ICONS } from "@/enums";
import type { CategoryId, ILocale } from "@/types";
import { MERCHANT_CATEGORY_OVERRIDES } from "@/lib/merchantCategoryOverrides";
import { createTranslator } from "@/lib/i18n";
import { normalizeStr } from "@/lib/stringUtils";

export type MerchantCategoryId =
  | "supermarket"
  | "restaurant"
  | "coffee"
  | "bakery"
  | "gym"
  | "shopping"
  | "bars"
  | "hotels";

type WeightedTerms = {
  mcc?: string[];
  name?: string[];
  product?: string[];
  exclude?: string[];
};

export type MerchantCategoryDefinition = {
  id: MerchantCategoryId;
  icon: ICONS;
  networkCategoryId: CategoryId;
  aliases: string[];
  terms: WeightedTerms;
  primaryThreshold?: number;
  secondaryThreshold?: number;
};

const MERCHANT_CATEGORY_TRANSLATION_KEYS: Record<
  MerchantCategoryId,
  { label: string; pluralLabel: string; helperText: string }
> = {
  supermarket: {
    label: "merchantCategorySupermarket",
    pluralLabel: "merchantCategorySupermarketPlural",
    helperText: "merchantCategorySupermarketHelper",
  },
  restaurant: {
    label: "merchantCategoryRestaurant",
    pluralLabel: "merchantCategoryRestaurantPlural",
    helperText: "merchantCategoryRestaurantHelper",
  },
  coffee: {
    label: "merchantCategoryCoffee",
    pluralLabel: "merchantCategoryCoffeePlural",
    helperText: "merchantCategoryCoffeeHelper",
  },
  bakery: {
    label: "merchantCategoryBakery",
    pluralLabel: "merchantCategoryBakeryPlural",
    helperText: "merchantCategoryBakeryHelper",
  },
  gym: {
    label: "merchantCategoryGym",
    pluralLabel: "merchantCategoryGymPlural",
    helperText: "merchantCategoryGymHelper",
  },
  shopping: {
    label: "merchantCategoryShopping",
    pluralLabel: "merchantCategoryShoppingPlural",
    helperText: "merchantCategoryShoppingHelper",
  },
  bars: {
    label: "merchantCategoryBars",
    pluralLabel: "merchantCategoryBarsPlural",
    helperText: "merchantCategoryBarsHelper",
  },
  hotels: {
    label: "merchantCategoryHotels",
    pluralLabel: "merchantCategoryHotelsPlural",
    helperText: "merchantCategoryHotelsHelper",
  },
};

export type MerchantCategoryEvidence = {
  categoryId: MerchantCategoryId;
  score: number;
  matches: string[];
};

export type MerchantCategorization = {
  primaryCategoryId: MerchantCategoryId;
  secondaryCategoryIds: MerchantCategoryId[];
  networkCategoryId: CategoryId;
  confidence: "high" | "medium" | "low";
  evidence: MerchantCategoryEvidence[];
};

const DEFAULT_PRIMARY_THRESHOLD = 60;
const DEFAULT_SECONDARY_THRESHOLD = 75;
const MCC_MATCH_SCORE = 90;
const PRODUCT_MATCH_SCORE = 65;
const NAME_MATCH_SCORE = 64;
const VAT_MATCH_SCORE = 32;
const EXCLUSION_PENALTY = 120;

export const MERCHANT_CATEGORY_DEFINITIONS: MerchantCategoryDefinition[] = [
  {
    id: "supermarket",
    icon: ICONS.BASKET,
    networkCategoryId: "meal",
    aliases: ["supermarket", "super market", "grocery", "groceries", "market", "παντοπωλειο", "σουπερ μαρκετ"],
    terms: {
      mcc: ["supermarket", "super market", "grocery", "groceries", "market", "παντοπωλειο", "σουπερ*", "μαρκετ"],
      name: ["supermarket", "super market", "grocery", "market", "παντοπωλειο", "σουπερ*", "μαρκετ"],
    },
  },
  {
    id: "restaurant",
    icon: ICONS.FORK_KNIFE,
    networkCategoryId: "meal",
    aliases: ["restaurant", "food", "eat", "dinner", "lunch", "εστιατοριο", "φαγητο", "σουβλακι"],
    terms: {
      mcc: ["restaurant", "food", "dining", "lunch", "dinner", "εστιατορ*", "φαγη*", "σουβλακ*"],
      name: ["restaurant", "taverna", "grill", "souvlaki", "eat", "εστιατορ*", "ταβερν*", "ψητοπωλ*", "σουβλακ*"],
      product: ["go for eat", "cheque dejeuner", "chèque déjeuner"],
      exclude: ["coffee", "cafe", "bar", "bakery"],
    },
  },
  {
    id: "coffee",
    icon: ICONS.COFFEE,
    networkCategoryId: "meal",
    aliases: ["coffee", "cafe", "café", "espresso", "καφες", "καφε", "καφετερια"],
    terms: {
      mcc: ["coffee", "cafe", "café", "espresso", "καφε*"],
      name: ["coffee", "cafe", "café", "espresso", "roastery", "καφε*"],
    },
  },
  {
    id: "bakery",
    icon: ICONS.COOKIE,
    networkCategoryId: "meal",
    aliases: ["bakery", "bakeries", "bread", "pastry", "φουρνος", "αρτοποιειο"],
    terms: {
      mcc: ["bakery", "bakeries", "bread", "pastry", "αρτοποι*", "φουρ*"],
      name: ["bakery", "bread", "pastry", "αρτοποι*", "φουρ*"],
    },
  },
  {
    id: "gym",
    icon: ICONS.BARBELL,
    networkCategoryId: "gyms",
    aliases: ["gym", "fitness", "wellness", "pilates", "crossfit", "γυμναστηριο", "γυμναστηρια"],
    terms: {
      mcc: ["gym", "fitness", "pilates", "crossfit", "workout", "athletic", "γυμναστ*"],
      name: ["gym", "fitness", "pilates", "crossfit", "workout", "athletic", "γυμναστ*"],
      product: ["fitpass"],
    },
    secondaryThreshold: 90,
  },
  {
    id: "shopping",
    icon: ICONS.SHOPPING_BAG,
    networkCategoryId: "rewards",
    aliases: ["shopping", "retail", "store", "shop", "gift", "mall", "αγορες", "καταστημα", "δωρα"],
    terms: {
      mcc: ["shopping", "retail", "store", "shop", "gift", "mall", "αγορ*", "καταστημα", "δωρ*"],
      name: ["shop", "store", "gift", "mall", "αγορ*", "καταστημα", "δωρ*"],
    },
    primaryThreshold: 75,
  },
  {
    id: "bars",
    icon: ICONS.MARTINI,
    networkCategoryId: "meal",
    aliases: ["bar", "beer", "wine", "drink", "cocktail", "μπαρ", "ποτο", "ποτα", "κρασι"],
    terms: {
      mcc: ["bar", "beer", "wine", "drink", "cocktail", "μπαρ", "ποτο", "κρασι"],
      name: ["bar", "beer", "wine", "cocktail", "μπαρ", "κρασι"],
    },
  },
  {
    id: "hotels",
    icon: ICONS.BED,
    networkCategoryId: "expenses",
    aliases: ["hotel", "hostel", "accommodation", "lodging", "travel", "ξενοδοχειο", "διαμονη", "ταξιδι"],
    terms: {
      mcc: ["hotel", "hostel", "accommodation", "lodging", "travel", "ξενοδοχ*", "διαμον*", "ταξιδ*"],
      name: ["hotel", "hostel", "ξενοδοχ*"],
    },
  },
];

const CATEGORY_BY_ID = new Map(
  MERCHANT_CATEGORY_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const categorizationCache = new Map<string, MerchantCategorization>();

const normalizeValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item)).join(" ");
  if (value === null || value === undefined) return "";
  return normalizeStr(String(value));
};

const normalizeTokens = (value: string): string[] =>
  value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

const getFieldText = (
  properties: Record<string, unknown>,
  keys: string[],
): string => keys.map((key) => normalizeValue(properties[key])).filter(Boolean).join(" ");

const getOverrideKeys = (properties: Record<string, unknown>): string[] =>
  [
    properties.ID,
    properties.MerchantId,
    properties.mongo_id,
    properties.VATNameEN,
    properties.VATNameGR,
    properties.BrandNameEN,
    properties.BrandNameGR,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

const getCategorizationCacheKey = (properties: Record<string, unknown>): string =>
  [
    properties.ID,
    properties.MerchantId,
    properties.mongo_id,
    properties.BrandNameEN,
    properties.BrandName_EN,
    properties.BrandNameGR,
    properties.BrandName_GR,
    properties.VATNameEN,
    properties.VATName_EN,
    properties.VATNameGR,
    properties.VATName_GR,
    properties.MCCCategoryEN,
    properties.MCCCategory_EN,
    properties.MCCCategoryGR,
    properties.MCCCategory_GR,
    properties.MCCCategory,
    properties.AcceptedProducts,
    properties.__source,
    properties.VenueType,
    properties.venueType,
  ]
    .map((value) => normalizeValue(value))
    .join("|");

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const termMatches = (text: string, tokens: string[], rawTerm: string): boolean => {
  const normalizedTerm = normalizeStr(rawTerm.trim());
  if (!normalizedTerm) return false;

  if (normalizedTerm.endsWith("*")) {
    const prefix = normalizedTerm.slice(0, -1);
    return tokens.some((token) => token.startsWith(prefix));
  }

  if (normalizedTerm.includes(" ")) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`).test(text);
  }

  return tokens.includes(normalizedTerm);
};

const collectMatches = (text: string, terms: string[] = []): string[] => {
  const tokens = normalizeTokens(text);
  return terms.filter((term) => termMatches(text, tokens, term));
};

const scoreDefinition = (
  definition: MerchantCategoryDefinition,
  fields: ReturnType<typeof buildMerchantCategoryFields>,
): MerchantCategoryEvidence => {
  let score = 0;
  const matches: string[] = [];
  const excluded = collectMatches(fields.all, definition.terms.exclude);

  const addScore = (fieldName: string, fieldScore: number, fieldText: string, terms?: string[]) => {
    const fieldMatches = collectMatches(fieldText, terms);
    if (fieldMatches.length === 0) return;
    score += fieldScore;
    matches.push(`${fieldName}:${fieldMatches.join("|")}`);
  };

  addScore("mcc", MCC_MATCH_SCORE, fields.mcc, definition.terms.mcc);
  addScore("product", PRODUCT_MATCH_SCORE, fields.products, definition.terms.product);
  addScore("name", NAME_MATCH_SCORE, fields.name, definition.terms.name);
  addScore("vat", VAT_MATCH_SCORE, fields.vat, definition.terms.name);

  if (excluded.length > 0) {
    score -= EXCLUSION_PENALTY;
    matches.push(`exclude:${excluded.join("|")}`);
  }

  return {
    categoryId: definition.id,
    score: Math.max(0, score),
    matches,
  };
};

const buildMerchantCategoryFields = (properties: Record<string, unknown>) => {
  const name = getFieldText(properties, ["BrandNameEN", "BrandName_EN", "BrandNameGR", "BrandName_GR"]);
  const vat = getFieldText(properties, ["VATNameEN", "VATName_EN", "VATNameGR", "VATName_GR"]);
  const mcc = getFieldText(properties, ["MCCCategoryEN", "MCCCategory_EN", "MCCCategoryGR", "MCCCategory_GR", "MCCCategory"]);
  const products = getFieldText(properties, ["AcceptedProducts"]);
  const source = getFieldText(properties, ["__source"]);
  const venue = getFieldText(properties, ["VenueType", "venueType"]);

  return {
    name,
    vat,
    mcc,
    products,
    source,
    venue,
    all: [name, vat, mcc, products, source, venue].filter(Boolean).join(" "),
  };
};

const getFallbackCategoryId = (fields: ReturnType<typeof buildMerchantCategoryFields>): MerchantCategoryId => {
  if (collectMatches(fields.products, ["fitpass"]).length > 0) return "gym";
  if (collectMatches(fields.products, ["go for eat", "cheque dejeuner", "chèque déjeuner"]).length > 0) {
    return "restaurant";
  }
  if (collectMatches(fields.products, ["expense"]).length > 0) return "shopping";
  if (collectMatches(fields.products, ["gift", "flexone"]).length > 0) return "shopping";
  return "shopping";
};

export const resolveMerchantNetworkCategoryFromProperties = (
  properties: Record<string, unknown>,
): CategoryId => {
  const source = normalizeValue(properties.__source);
  if (source === "up_hellas") return "meal";
  if (source === "nyamie") return "gyms";

  const products = normalizeValue(properties.AcceptedProducts);
  const productTokens = normalizeTokens(products);
  if (termMatches(products, productTokens, "fitpass")) return "gyms";
  if (
    ["go for eat", "cheque dejeuner", "chèque déjeuner", "meal"].some((term) =>
      termMatches(products, productTokens, term),
    )
  ) {
    return "meal";
  }
  if (termMatches(products, productTokens, "expense")) return "expenses";
  return "rewards";
};

const confidenceForScore = (score: number): MerchantCategorization["confidence"] => {
  if (score >= 100) return "high";
  if (score >= DEFAULT_PRIMARY_THRESHOLD) return "medium";
  return "low";
};

export const resolveMerchantCategorization = (
  properties: Record<string, unknown>,
): MerchantCategorization => {
  const cacheKey = getCategorizationCacheKey(properties);
  const cached = categorizationCache.get(cacheKey);
  if (cached) return cached;

  const override = getOverrideKeys(properties)
    .map((key) => MERCHANT_CATEGORY_OVERRIDES[key])
    .find(Boolean);
  const fields = buildMerchantCategoryFields(properties);
  const evidence = MERCHANT_CATEGORY_DEFINITIONS
    .map((definition) => scoreDefinition(definition, fields))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestEvidence = evidence[0];
  const fallbackCategoryId = getFallbackCategoryId(fields);
  const networkCategoryId = resolveMerchantNetworkCategoryFromProperties(properties);
  const primaryDefinition = bestEvidence &&
    bestEvidence.score >= (getCategoryDefinition(bestEvidence.categoryId).primaryThreshold ?? DEFAULT_PRIMARY_THRESHOLD)
    ? getCategoryDefinition(bestEvidence.categoryId)
    : getCategoryDefinition(fallbackCategoryId);

  const secondaryCategoryIds = evidence
    .filter((entry) => entry.categoryId !== primaryDefinition.id)
    .filter((entry) => {
      const definition = getCategoryDefinition(entry.categoryId);
      return entry.score >= (definition.secondaryThreshold ?? DEFAULT_SECONDARY_THRESHOLD);
    })
    .slice(0, 2)
    .map((entry) => entry.categoryId);

  if (override) {
    const result: MerchantCategorization = {
      primaryCategoryId: override.primaryCategoryId,
      secondaryCategoryIds: override.secondaryCategoryIds ?? secondaryCategoryIds,
      networkCategoryId,
      confidence: "high",
      evidence: [
        {
          categoryId: override.primaryCategoryId,
          score: 999,
          matches: ["override"],
        },
        ...evidence,
      ],
    };
    categorizationCache.set(cacheKey, result);
    return result;
  }

  const result = {
    primaryCategoryId: primaryDefinition.id,
    secondaryCategoryIds,
    networkCategoryId,
    confidence: confidenceForScore(bestEvidence?.score ?? 0),
    evidence,
  };
  categorizationCache.set(cacheKey, result);
  return result;
};

export const getCategoryDefinition = (categoryId: MerchantCategoryId): MerchantCategoryDefinition => {
  const definition = CATEGORY_BY_ID.get(categoryId);
  if (!definition) throw new Error(`Unknown merchant category: ${categoryId}`);
  return definition;
};

export const getMerchantCategoryIcon = (categoryId: MerchantCategoryId): ICONS =>
  getCategoryDefinition(categoryId).icon;

export const getMerchantCategoryLabel = (categoryId: MerchantCategoryId, locale: ILocale): string => {
  const translationKey = MERCHANT_CATEGORY_TRANSLATION_KEYS[categoryId].label;
  const translated = createTranslator(locale).t(translationKey);
  return translated === translationKey ? categoryId : translated;
};

export const getMerchantCategoryPluralLabel = (categoryId: MerchantCategoryId, locale: ILocale): string => {
  const translationKey = MERCHANT_CATEGORY_TRANSLATION_KEYS[categoryId].pluralLabel;
  const translated = createTranslator(locale).t(translationKey);
  return translated === translationKey ? getMerchantCategoryLabel(categoryId, locale) : translated;
};

export const getMerchantCategoryHelperText = (categoryId: MerchantCategoryId, locale: ILocale): string => {
  const translationKey = MERCHANT_CATEGORY_TRANSLATION_KEYS[categoryId].helperText;
  const translated = createTranslator(locale).t(translationKey);
  return translated === translationKey ? "" : translated;
};

export const getMerchantCategorySearchTerms = (categoryId: MerchantCategoryId, locale: ILocale): string[] => {
  const definition = getCategoryDefinition(categoryId);
  return [
    getMerchantCategoryLabel(categoryId, locale),
    getMerchantCategoryPluralLabel(categoryId, locale),
    getMerchantCategoryHelperText(categoryId, locale),
    ...definition.aliases,
  ];
};

export const merchantCategorizationIncludes = (
  categorization: MerchantCategorization,
  categoryId: MerchantCategoryId,
): boolean =>
  categorization.primaryCategoryId === categoryId ||
  categorization.secondaryCategoryIds.includes(categoryId);
