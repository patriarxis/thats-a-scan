import type { MerchantFeature } from "@/types";
import {
  resolveMerchantNetworkCategoryFromProperties,
} from "@/lib/merchantCategorization";

export type MerchantFilterOption = { id: string; label: string };
export type NetworkFilterOption = MerchantFilterOption;

export const MERCHANT_FILTER_DEFINITIONS = [
  { id: "mealPlus", label: "FlexOne - Meal+ / go for EAT" },
  { id: "up-gift", label: "Up Gift" },
  { id: "cheque-dejeuner", label: "Chèque Déjeuner" },
  { id: "fitpass", label: "Fitpass" },
] as const;
export const NETWORK_FILTER_DEFINITIONS = MERCHANT_FILTER_DEFINITIONS;

type AcceptedProductId =
  | "flexone"
  | "go-for-eat"
  | "up-gift"
  | "fitpass"
  | "cheque-dejeuner";

type MerchantFilterId = (typeof MERCHANT_FILTER_DEFINITIONS)[number]["id"];

const ACCEPTED_PRODUCT_PATTERNS: ReadonlyArray<{
  id: AcceptedProductId;
  pattern: RegExp;
}> = [
  { id: "fitpass", pattern: /\bfitpass\b/i },
  { id: "flexone", pattern: /\bflexone\b/i },
  { id: "up-gift", pattern: /\bup[\s-]*gift\b/i },
  { id: "cheque-dejeuner", pattern: /\bch[eè]que[\s-]*d[eé]jeuner\b/i },
  { id: "go-for-eat", pattern: /\bgo[\s-]*for[\s-]*eat\b/i },
];

export function resolveMerchantCategoryFromProperties(
  properties: Record<string, unknown>,
): "meal" | "gyms" | "expenses" | "rewards" {
  return resolveMerchantNetworkCategoryFromProperties(properties);
}

export function resolveMerchantCategory(merchant: MerchantFeature): "meal" | "gyms" | "expenses" | "rewards" {
  return resolveMerchantCategoryFromProperties(merchant.properties);
}

export function parseAcceptedProducts(value: unknown): string[] {
  let raw: string[] = [];
  if (Array.isArray(value)) {
    raw = value.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof value === "string") {
    raw = value.split(/[;,|/]/g).map((item) => item.trim()).filter(Boolean);
  }

  return raw;
}

const resolveAcceptedProducts = (properties: Record<string, unknown>): AcceptedProductId[] => {
  const acceptedProducts = parseAcceptedProducts(properties.AcceptedProducts);
  const products = new Set<AcceptedProductId>();

  for (const product of acceptedProducts) {
    for (const { id, pattern } of ACCEPTED_PRODUCT_PATTERNS) {
      if (pattern.test(product)) {
        products.add(id);
      }
    }
  }

  return Array.from(products);
};

export function resolveMerchantProductIdsFromProperties(
  properties: Record<string, unknown>,
): string[] {
  return resolveMerchantAcceptedProductIdsFromProperties(properties);
}

export function resolveMerchantAcceptedProductIdsFromProperties(
  properties: Record<string, unknown>,
): AcceptedProductId[] {
  return resolveAcceptedProducts(properties);
}

export function resolveMerchantNetworkIdsFromProperties(
  properties: Record<string, unknown>,
): MerchantFilterId[] {
  const category = resolveMerchantCategoryFromProperties(properties);
  const acceptedProducts = resolveAcceptedProducts(properties);
  const networks = new Set<MerchantFilterId>();

  if (acceptedProducts.includes("go-for-eat")) {
    networks.add("mealPlus");
  }

  if (category === "meal" && acceptedProducts.length === 0) {
    // Keep meal partners discoverable when upstream omits AcceptedProducts.
    networks.add("mealPlus");
  }

  return Array.from(networks);
}

export function resolveMerchantProductIds(merchant: MerchantFeature): string[] {
  return resolveMerchantAcceptedProductIdsFromProperties(merchant.properties);
}

export function resolveMerchantAcceptedProductIds(merchant: MerchantFeature): AcceptedProductId[] {
  return resolveMerchantAcceptedProductIdsFromProperties(merchant.properties);
}

export function buildMerchantFilterOptions(_merchants: MerchantFeature[]): MerchantFilterOption[] {
  return MERCHANT_FILTER_DEFINITIONS.map((network) => ({
    id: network.id,
    label: network.label,
  }));
}

export function buildNetworkFilterOptions(_merchants: MerchantFeature[]): NetworkFilterOption[] {
  return buildMerchantFilterOptions(_merchants);
}

export function merchantHasCashback(merchant: MerchantFeature): boolean {
  for (const [key, rawValue] of Object.entries(merchant.properties)) {
    if (!key.toLowerCase().includes("cashback")) continue;
    if (typeof rawValue === "number") return rawValue > 0;
    if (typeof rawValue === "boolean") return rawValue;
    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized) continue;
    if (["0", "false", "no", "none", "n/a", "-", "null"].includes(normalized)) continue;
    return true;
  }
  return false;
}

export function merchantMatchesFilters(
  merchant: MerchantFeature,
  selectedFilterIds: string[],
): boolean {
  const merchantNetworks = resolveMerchantNetworkIdsFromProperties(merchant.properties);
  const merchantProducts = resolveMerchantAcceptedProductIds(merchant);
  const selectedFilters = new Set(selectedFilterIds);

  if (selectedFilters.size > 0) {
    const matchesAnyFilter =
      (selectedFilters.has("mealPlus") && merchantNetworks.includes("mealPlus")) ||
      (selectedFilters.has("up-gift") && merchantProducts.includes("up-gift")) ||
      (selectedFilters.has("cheque-dejeuner") && merchantProducts.includes("cheque-dejeuner")) ||
      (selectedFilters.has("fitpass") && merchantProducts.includes("fitpass"));

    if (!matchesAnyFilter) {
      return false;
    }
  }

  return true;
}

