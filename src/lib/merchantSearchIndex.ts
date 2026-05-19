import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  isPartnerDigital,
  type ILocale,
  type MerchantFeature,
} from "@/types";
import { normalizeStr } from "./stringUtils";
import {
  getMerchantCategorySearchTerms,
  merchantCategorizationIncludes,
  resolveMerchantCategorization,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";
import { MAP_SEARCH_MAX_FEATURES } from "@/lib/config";

export type MerchantSuggestion = {
  id: string;
  merchantId: string;
  label: string;
  sublabel: string;
  coordinates: [number, number];
  isDigital?: boolean;
  score?: number;
};

export type MapSearchFilterResult = {
  features: MerchantFeature[];
  total: number;
  truncated: boolean;
};

type IndexEntry = {
  merchantId: string;
  feature: MerchantFeature;
  normalizedLabel: string;
  normalizedSublabel: string;
  normalizedCategoryText: string;
};

/** City name groups for localized queries (e.g. "supermarket thessaloniki"). */
const SEARCH_CITY_ALIAS_GROUPS: readonly string[][] = [
  ["αθηνα", "athens", "athina"],
  ["θεσσαλονικη", "thessaloniki", "salonica"],
  ["πειραιας", "piraeus", "peiraias", "peiraieus"],
  ["πατρα", "patras"],
  ["ηρακλειο", "heraklion", "iraklio"],
  ["λαρισα", "larissa"],
  ["βολος", "volos"],
  ["ιωαννινα", "ioannina"],
  ["χανια", "chania"],
  ["ρεθυμνο", "rethymno"],
  ["ροδος", "rhodes", "rodos"],
  ["κερκυρα", "corfu", "kerkyra"],
];

const CITY_ALIAS_TO_GROUP = new Map<string, number>();
for (let groupIndex = 0; groupIndex < SEARCH_CITY_ALIAS_GROUPS.length; groupIndex += 1) {
  for (const alias of SEARCH_CITY_ALIAS_GROUPS[groupIndex]!) {
    CITY_ALIAS_TO_GROUP.set(alias, groupIndex);
  }
}

export type ParsedSearchQuery = {
  cityGroupIndices: number[];
  cityAliases: string[];
  searchTokens: string[];
  /** Remaining text for single-string fallback matching. */
  searchText: string;
};

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const normalized = normalizeStr(query.trim());
  if (!normalized) {
    return { cityGroupIndices: [], cityAliases: [], searchTokens: [], searchText: "" };
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const cityGroupIndices: number[] = [];
  const cityAliases: string[] = [];
  const searchTokens: string[] = [];

  for (const token of tokens) {
    const groupIndex = CITY_ALIAS_TO_GROUP.get(token);
    if (groupIndex !== undefined) {
      if (!cityGroupIndices.includes(groupIndex)) {
        cityGroupIndices.push(groupIndex);
        cityAliases.push(...SEARCH_CITY_ALIAS_GROUPS[groupIndex]!);
      }
    } else {
      searchTokens.push(token);
    }
  }

  return {
    cityGroupIndices,
    cityAliases,
    searchTokens,
    searchText: searchTokens.join(" "),
  };
}

function addressMatchesCityGroups(normalizedAddress: string, parsed: ParsedSearchQuery): boolean {
  if (parsed.cityAliases.length === 0) return true;
  return parsed.cityAliases.some((alias) => normalizedAddress.includes(alias));
}

function scoreEntryForParsedQuery(entry: IndexEntry, parsed: ParsedSearchQuery): number {
  if (!addressMatchesCityGroups(entry.normalizedSublabel, parsed)) {
    return 0;
  }

  const normalizedQuery = parsed.searchText;
  if (!normalizedQuery) {
    return parsed.cityAliases.length > 0 ? 15 : 0;
  }

  if (entry.normalizedLabel.startsWith(normalizedQuery)) {
    return 100;
  }
  if (entry.normalizedLabel.includes(normalizedQuery)) {
    return 75;
  }
  if (parsed.searchTokens.length > 1) {
    const allTokensInLabel = parsed.searchTokens.every((token) =>
      entry.normalizedLabel.includes(token),
    );
    const allTokensInCategory = parsed.searchTokens.every((token) =>
      entry.normalizedCategoryText.includes(token),
    );
    if (allTokensInLabel) return 72;
    if (allTokensInCategory) return 68;
  }
  if (entry.normalizedSublabel.startsWith(normalizedQuery)) {
    return 50;
  }
  if (entry.normalizedSublabel.includes(normalizedQuery)) {
    return 25;
  }
  if (entry.normalizedCategoryText.includes(normalizedQuery)) {
    return 20;
  }
  if (parsed.searchTokens.length > 1) {
    const allTokensAnywhere = parsed.searchTokens.every(
      (token) =>
        entry.normalizedLabel.includes(token) ||
        entry.normalizedSublabel.includes(token) ||
        entry.normalizedCategoryText.includes(token),
    );
    if (allTokensAnywhere) return 18;
  }
  return 0;
}

function scoreEntryForLegacyQuery(entry: IndexEntry, normalizedQuery: string): number {
  if (entry.normalizedLabel.startsWith(normalizedQuery)) {
    return 100;
  }
  if (entry.normalizedLabel.includes(normalizedQuery)) {
    return 75;
  }
  if (entry.normalizedSublabel.startsWith(normalizedQuery)) {
    return 50;
  }
  if (entry.normalizedSublabel.includes(normalizedQuery)) {
    return 25;
  }
  if (entry.normalizedCategoryText.includes(normalizedQuery)) {
    return 20;
  }
  return 0;
}

function scoreEntry(entry: IndexEntry, query: string): number {
  const parsed = parseSearchQuery(query);
  if (parsed.cityGroupIndices.length > 0 || parsed.searchTokens.length > 1) {
    return scoreEntryForParsedQuery(entry, parsed);
  }
  const normalizedQuery = normalizeStr(query.trim());
  if (!normalizedQuery) return 0;
  return scoreEntryForLegacyQuery(entry, normalizedQuery);
}

export function buildSearchIndex(features: MerchantFeature[], locale: ILocale): IndexEntry[] {
  return features.map((feature) => {
    const merchantId = getMerchantId(feature);
    const name = getMerchantName(feature, locale);
    const address = getMerchantAddress(feature, locale);
    const categorization = resolveMerchantCategorization(feature.properties);
    const categoryTerms = [
      categorization.primaryCategoryId,
      ...categorization.secondaryCategoryIds,
    ].flatMap((categoryId) => getMerchantCategorySearchTerms(categoryId, locale));
    return {
      merchantId,
      feature,
      normalizedLabel: normalizeStr(name),
      normalizedSublabel: normalizeStr(address),
      normalizedCategoryText: normalizeStr(categoryTerms.join(" ")),
    };
  });
}

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

function matchesCategory(
  feature: MerchantFeature,
  categoryId: MerchantCategoryId,
): boolean {
  return merchantCategorizationIncludes(
    resolveMerchantCategorization(feature.properties),
    categoryId,
  );
}

export function searchMerchantSuggestions(
  query: string,
  features: MerchantFeature[],
  locale: ILocale,
  limit = 8,
): MerchantSuggestion[] {
  const normalizedQuery = normalizeStr(query.trim());
  if (!normalizedQuery) return [];

  const index = getOrBuildIndex(features, locale);
  const matches: MerchantSuggestion[] = [];

  for (const entry of index) {
    const score = scoreEntry(entry, query);
    if (score > 0) {
      matches.push({
        id: `merchant:${entry.merchantId}`,
        merchantId: entry.merchantId,
        label: getMerchantName(entry.feature, locale),
        sublabel: getMerchantAddress(entry.feature, locale),
        coordinates: entry.feature.geometry.coordinates,
        isDigital: isPartnerDigital(entry.feature),
        score,
      });
    }
  }

  return matches
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

export function filterMerchantsForMapSearch(
  query: string,
  features: MerchantFeature[],
  locale: ILocale,
  options?: {
    categoryId?: MerchantCategoryId;
    limit?: number;
  },
): MapSearchFilterResult {
  const limit = options?.limit ?? MAP_SEARCH_MAX_FEATURES;
  const normalizedQuery = normalizeStr(query.trim());
  const categoryId = options?.categoryId;

  let candidates = features;
  if (categoryId) {
    candidates = candidates.filter((feature) => matchesCategory(feature, categoryId));
  }

  if (!normalizedQuery && !categoryId) {
    return { features: [], total: 0, truncated: false };
  }

  if (!normalizedQuery && categoryId) {
    const total = candidates.length;
    const truncated = total > limit;
    return {
      features: candidates.slice(0, limit),
      total,
      truncated,
    };
  }

  const index = getOrBuildIndex(candidates, locale);
  const scored: { feature: MerchantFeature; score: number }[] = [];

  for (const entry of index) {
    const score = scoreEntry(entry, query);
    if (score > 0) {
      scored.push({ feature: entry.feature, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const total = scored.length;
  const truncated = total > limit;

  return {
    features: scored.slice(0, limit).map((item) => item.feature),
    total,
    truncated,
  };
}

export function merchantMatchesSearchQuery(
  merchant: MerchantFeature,
  query: string,
  locale: ILocale,
): boolean {
  const normalizedQuery = normalizeStr(query.trim());
  if (!normalizedQuery) return true;

  const entry: IndexEntry = {
    merchantId: getMerchantId(merchant),
    feature: merchant,
    normalizedLabel: normalizeStr(getMerchantName(merchant, locale)),
    normalizedSublabel: normalizeStr(getMerchantAddress(merchant, locale)),
    normalizedCategoryText: normalizeStr(
      (() => {
        const categorization = resolveMerchantCategorization(merchant.properties);
        return [
          categorization.primaryCategoryId,
          ...categorization.secondaryCategoryIds,
        ]
          .flatMap((categoryId) => getMerchantCategorySearchTerms(categoryId, locale))
          .join(" ");
      })(),
    ),
  };

  return scoreEntry(entry, query) > 0;
}
