import type { CategoryId, MerchantFeature } from "@/types";

export type ProductFilterOption = { id: string; label: string };
export type WalletFilterOption = { id: string; label: string };

// Mapping of wallet IDs to keywords/MCC categories
export const WALLET_MAPPING: Record<string, string[]> = {
  "meal": ["φαγητό", "εστιατόριο", "super market", "bakery", "ψιλικά", "κρεοπωλείο", "ιχθυοπωλείο", "μανάβικο", "cafe", "restaurant", "food", "γεύμα"],
  "rewards": ["επιβράβευση", "bonus", "reward", "store", "εμπόριο"],
  "mobility": ["βενζίνη", "fuel", "gas", "parking", "διόδια", "μετακίνηση", "αυτοκίνητο"],
  "public_transport": ["λεωφορείο", "μετρό", "transit", "train", "μμμ", "μέσα μαζικής μεταφοράς"],
  "wellness": ["gym", "wellness", "spa", "fitness", "yoga", "pilates", "ευεξία"],
  "learning": ["σχολείο", "φροντιστήριο", "εκπαίδευση", "books", "bookshelf", "career", "μάθηση"],
  "vacations": ["hotel", "travel", "διακοπές", "vacation", "ξενοδοχείο"],
  "childcare": ["kindergarten", "παιδικός σταθμός"],
  "clothing": ["fashion", "ρούχα", "ένδυση", "clothing", "shoes"],
  "beauty": ["beauty", "κομμωτήριο", "nails", "cosmetics", "ομορφιά"],
  "wfh": ["office", "wfh", "furniture", "electronics"],
  "culture": ["cinema", "theater", "culture", "museum", "concert", "πολιτισμός"],
  "health": ["pharmacy", "doctor", "health", "hospital", "υγεία"],
  "safety": ["insurance", "ασφάλεια"],
};

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
      "fitpass",
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
  let raw: string[] = [];
  if (Array.isArray(value)) {
    raw = value.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof value === "string") {
    raw = value.split(/[;,|/]/g).map((item) => item.trim()).filter(Boolean);
  }

  // Normalize product names to match user expectations
  return raw.map(product => {
    const p = product.toLowerCase();
    if (p.includes("flexone")) return "FlexOne";
    if (p.includes("fitpass")) return "Fitpass";
    if (p.includes("expense")) return "Up Expense";
    if (p.includes("eat")) return "Up Meal";
    if (p.includes("gift")) return "Up Gift";
    return product;
  });
}

export function resolveMerchantWallets(merchant: MerchantFeature): string[] {
  const mccLabel = normalizeText(
    merchant.properties.MCCCategory_EN ?? merchant.properties.MCCCategoryGR,
  );
  const brandName = normalizeText(
    merchant.properties.BrandName_EN ?? merchant.properties.BrandName_GR,
  );
  const searchText = `${mccLabel} ${brandName}`;

  const matchedWallets: string[] = [];
  for (const [walletId, keywords] of Object.entries(WALLET_MAPPING)) {
    if (hasAnyNeedle(searchText, keywords)) {
      matchedWallets.push(walletId);
    }
  }

  // If it's a "meal" merchant (by category), it should definitely be in "meal" wallet if not already
  const category = resolveMerchantCategory(merchant);
  if (category === "meal" && !matchedWallets.includes("meal")) {
    matchedWallets.push("meal");
  }
  if (category === "gyms" && !matchedWallets.includes("wellness")) {
    matchedWallets.push("wellness");
  }

  return matchedWallets;
}

export function buildProductFilterOptions(merchants: MerchantFeature[]): ProductFilterOption[] {
  const byId = new Map<string, ProductFilterOption>();

  // Ensure important products are always included if they are relevant to the app
  const importantProducts = ["FlexOne", "Fitpass", "Up Expense", "Up Meal", "Up Gift"];
  
  for (const merchant of merchants) {
    for (const normalizedProduct of parseAcceptedProducts(merchant.properties.AcceptedProducts)) {
      const id = normalizedProduct.toLowerCase();
      if (!byId.has(id)) byId.set(id, { id, label: normalizedProduct });
    }
  }

  // If a product is mentioned by the user but wasn't found in current viewport, 
  // we could staticlly add them, but it might be confusing if no pins show up.
  // Instead, we just ensure the normalization is applied above.

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function buildWalletFilterOptions(): WalletFilterOption[] {
  return Object.keys(WALLET_MAPPING).map(id => ({
    id,
    label: id // Labels will be translated in UI
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
  selectedNetworkIds: CategoryId[],
  selectedProductIds: string[],
  selectedWalletIds: string[],
  cashbackOnly: boolean,
): boolean {
  if (selectedNetworkIds.length > 0) {
    const merchantCategory = resolveMerchantCategory(merchant);
    if (!selectedNetworkIds.includes(merchantCategory)) return false;
  }

  const merchantProducts = parseAcceptedProducts(merchant.properties.AcceptedProducts).map(
    (product) => product.toLowerCase(),
  );

  if (selectedProductIds.length > 0) {
    if (!selectedProductIds.some((selectedProduct) => merchantProducts.includes(selectedProduct))) {
      return false;
    }
  }

  if (selectedWalletIds.length > 0) {
    // Wallet filter only applies if FlexOne is selected OR if it's a general wallet filter
    // User said: "for the flexone we actually have many wallets inside the product... give the ability to filter the stores based on the wallet"
    // This implies that if FlexOne is active, we might want to narrow it down by wallets.
    const merchantWallets = resolveMerchantWallets(merchant);
    if (!selectedWalletIds.some((walletId) => merchantWallets.includes(walletId))) {
      return false;
    }
  }

  if (cashbackOnly && !merchantHasCashback(merchant)) return false;

  return true;
}

