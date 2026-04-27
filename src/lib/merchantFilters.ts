import type { MerchantFeature } from "@/types";
import { resolveMerchantNetworkCategoryFromProperties } from "@/lib/merchantCategorization";

export type ProductFilterOption = { id: string; label: string };
export const PRODUCT_DEFINITIONS = [
  { id: "flexone", label: "FlexOne" },
  { id: "up-gift", label: "Up Gift" },
  { id: "fitpass", label: "Fitpass" },
  { id: "up-expense", label: "Up Expense" },
  { id: "cheque-dejeuner", label: "Chèque Déjeuner" },
  { id: "go-for-eat", label: "go for EAT" },
] as const;

const MAIN_API_MEAL_PRODUCT_IDS = [
  "flexone",
  "up-gift",
  "up-expense",
  "cheque-dejeuner",
  "go-for-eat",
] as const;

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
  const source = normalizeText(properties.__source);
  const category = resolveMerchantCategoryFromProperties(properties);

  if (source === "up_hellas") {
    return [...MAIN_API_MEAL_PRODUCT_IDS];
  }

  const acceptedProducts = parseAcceptedProducts(properties.AcceptedProducts)
    .map((product) => normalizeText(product));
  const products = new Set<string>();

  for (const product of acceptedProducts) {
    if (product.includes("fitpass")) products.add("fitpass");
    if (product.includes("flexone")) products.add("flexone");
    if (product.includes("gift")) products.add("up-gift");
    if (product.includes("expense")) products.add("up-expense");
    if (product.includes("chèque") || product.includes("cheque")) {
      products.add("cheque-dejeuner");
    }
    if (product.includes("go for eat") || product.includes("eat")) {
      products.add("go-for-eat");
    }
  }

  if (category === "meal") {
    products.add("go-for-eat");
    products.add("cheque-dejeuner");
    products.add("flexone");
    products.add("up-gift");
    products.add("up-expense");
  }

  if (category === "gyms") {
    products.add("fitpass");
  }

  return [...products];
}

export function resolveMerchantProductIds(merchant: MerchantFeature): string[] {
  return resolveMerchantProductIdsFromProperties(merchant.properties);
}

export function buildProductFilterOptions(merchants: MerchantFeature[]): ProductFilterOption[] {
  return PRODUCT_DEFINITIONS.map((product) => ({
    id: product.id,
    label: product.label,
  }));
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
  selectedProductIds: string[],
  cashbackOnly: boolean,
): boolean {
  const merchantProducts = resolveMerchantProductIds(merchant);

  if (selectedProductIds.length > 0) {
    if (!selectedProductIds.some((selectedProduct) => merchantProducts.includes(selectedProduct))) {
      return false;
    }
  }

  if (cashbackOnly && !merchantHasCashback(merchant)) return false;

  return true;
}

