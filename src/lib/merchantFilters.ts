import type { MerchantFeature } from "@/types";
import {
  resolveMerchantNetworkCategoryFromProperties,
} from "@/lib/merchantCategorization";

export type MerchantFilterOption = { id: string; label: string };
export type NetworkFilterOption = MerchantFilterOption;

export const MERCHANT_FILTER_DEFINITIONS = [
  { id: "meal", label: "FlexOne - Meal" },
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

const MAIN_API_MEAL_PRODUCT_IDS: AcceptedProductId[] = [
  "flexone",
  "go-for-eat",
  "up-gift",
  "cheque-dejeuner",
];

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).join(" ");
  return "";
}

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

export function resolveMerchantProductIdsFromProperties(
  properties: Record<string, unknown>,
): string[] {
  return resolveMerchantAcceptedProductIdsFromProperties(properties);
}

export function resolveMerchantAcceptedProductIdsFromProperties(
  properties: Record<string, unknown>,
): AcceptedProductId[] {
  const source = normalizeText(properties.__source);
  const category = resolveMerchantCategoryFromProperties(properties);
  const products = new Set<AcceptedProductId>();

  if (source === "up_hellas") {
    for (const productId of MAIN_API_MEAL_PRODUCT_IDS) {
      products.add(productId);
    }
  }

  const acceptedProducts = parseAcceptedProducts(properties.AcceptedProducts)
    .map((product) => normalizeText(product));

  for (const product of acceptedProducts) {
    if (product.includes("fitpass")) products.add("fitpass");
    if (product.includes("flexone")) products.add("flexone");
    if (product.includes("gift")) products.add("up-gift");
    if (product.includes("chèque") || product.includes("cheque")) {
      products.add("cheque-dejeuner");
    }
    if (product.includes("go for eat") || product.includes("eat")) {
      products.add("go-for-eat");
    }
  }

  if (category === "meal") {
    products.add("flexone");
    products.add("go-for-eat");
    products.add("cheque-dejeuner");
    products.add("up-gift");
  }

  if (category === "gyms") {
    products.add("fitpass");
  }

  return Array.from(products);
}

export function resolveMerchantNetworkIdsFromProperties(
  properties: Record<string, unknown>,
): MerchantFilterId[] {
  const source = normalizeText(properties.__source);
  const category = resolveMerchantCategoryFromProperties(properties);
  const networks = new Set<MerchantFilterId>();

  if (source === "up_hellas") {
    // Temporary: until API exposes Tier-1 subset, meal and mealPlus share network coverage.
    networks.add("meal");
    networks.add("mealPlus");
  }

  const acceptedProducts = parseAcceptedProducts(properties.AcceptedProducts)
    .map((product) => normalizeText(product));

  for (const product of acceptedProducts) {
    if (
      product.includes("go for eat") ||
      product.includes("eat") ||
      product.includes("cheque") ||
      product.includes("chèque") ||
      product.includes("flexone")
    ) {
      networks.add("mealPlus");
      networks.add("meal");
    }
  }

  if (category === "meal") {
    networks.add("mealPlus");
    networks.add("meal");
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
  cashbackOnly: boolean,
): boolean {
  const merchantNetworks = resolveMerchantNetworkIdsFromProperties(merchant.properties);
  const merchantProducts = resolveMerchantAcceptedProductIds(merchant);
  const selectedFilters = new Set(selectedFilterIds);

  if (selectedFilters.size > 0) {
    const matchesAnyFilter =
      (selectedFilters.has("meal") && merchantNetworks.includes("meal")) ||
      (selectedFilters.has("mealPlus") && merchantNetworks.includes("mealPlus")) ||
      (selectedFilters.has("up-gift") && merchantProducts.includes("up-gift")) ||
      (selectedFilters.has("cheque-dejeuner") && merchantProducts.includes("cheque-dejeuner")) ||
      (selectedFilters.has("fitpass") && merchantProducts.includes("fitpass"));

    if (!matchesAnyFilter) {
      return false;
    }
  }

  if (cashbackOnly && !merchantHasCashback(merchant)) return false;

  return true;
}

