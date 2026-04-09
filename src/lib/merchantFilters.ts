import type { CategoryId, MerchantFeature } from "@/types";

export type ProductFilterOption = { id: string; label: string };

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).join(" ");
  return "";
}

function hasAnyNeedle(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function resolveMerchantCategoryFromProperties(
  properties: Record<string, unknown>,
): CategoryId {
  const valuesBlob = Object.values(properties)
    .map((value) => normalizeText(value))
    .join(" ");
  const mccLabel = normalizeText(
    properties.MCCCategory_EN ?? properties.MCCCategoryGR,
  );
  const acceptedProducts = normalizeText(properties.AcceptedProducts);
  const searchText = `${valuesBlob} ${mccLabel} ${acceptedProducts}`;

  if (
    hasAnyNeedle(searchText, [
      "gym",
      "fitness",
      "pilates",
      "crossfit",
      "workout",
      "dumbbell",
      "athletic",
    ])
  ) {
    return "gyms";
  }
  if (
    hasAnyNeedle(searchText, [
      "eat",
      "meal",
      "restaurant",
      "cafe",
      "coffee",
      "bakery",
      "bar",
      "food",
      "pizza",
      "souvlaki",
      "snack",
    ])
  ) {
    return "meal";
  }
  if (
    hasAnyNeedle(searchText, [
      "expense",
      "fuel",
      "transport",
      "taxi",
      "hotel",
      "travel",
      "business",
    ])
  ) {
    return "expenses";
  }
  return "rewards";
}

export function resolveMerchantCategory(merchant: MerchantFeature): CategoryId {
  return resolveMerchantCategoryFromProperties(merchant.properties);
}

export function parseAcceptedProducts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[;,|/]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildProductFilterOptions(merchants: MerchantFeature[]): ProductFilterOption[] {
  const byId = new Map<string, ProductFilterOption>();
  for (const merchant of merchants) {
    for (const rawProduct of parseAcceptedProducts(merchant.properties.AcceptedProducts)) {
      const id = rawProduct.toLowerCase();
      if (!byId.has(id)) byId.set(id, { id, label: rawProduct });
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
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
  selectedNetworkIds: CategoryId[],
  selectedProductIds: string[],
  cashbackOnly: boolean,
): boolean {
  if (selectedNetworkIds.length > 0) {
    const merchantCategory = resolveMerchantCategory(merchant);
    if (!selectedNetworkIds.includes(merchantCategory)) return false;
  }

  if (selectedProductIds.length > 0) {
    const merchantProducts = parseAcceptedProducts(merchant.properties.AcceptedProducts).map(
      (product) => product.toLowerCase(),
    );
    if (!selectedProductIds.some((selectedProduct) => merchantProducts.includes(selectedProduct))) {
      return false;
    }
  }

  if (cashbackOnly && !merchantHasCashback(merchant)) return false;

  return true;
}
