import { ICONS } from "@/enums";
import {
  resolveMerchantCategoryFromProperties,
  resolveMerchantProductIdsFromProperties,
} from "@/lib/merchantFilters";
import { getPartnerId, type CategoryId, type PartnerFeature } from "@/types";

export type MarkerCategoryIconKey =
  | ICONS.BARBELL
  | ICONS.BASKET
  | ICONS.FORK_KNIFE
  | ICONS.COFFEE
  | ICONS.COOKIE
  | ICONS.ASCLEPIUS
  | ICONS.STOREFRONT;

/** Category glyph or selected-state map pin */
export type MarkerGlyphKey = MarkerCategoryIconKey | ICONS.MAP_PIN;

export type ProductDotKey =
  | "fitpass"
  | "flexone"
  | "go_for_eat"
  | "up_gift"
  | "up_expense"
  | "cheque_dejeuner";

const PRODUCT_DOT_ORDER: ProductDotKey[] = [
  "fitpass",
  "flexone",
  "go_for_eat",
  "up_gift",
  "up_expense",
  "cheque_dejeuner",
];

export const PRODUCT_COLORS: Record<ProductDotKey, string> = {
  fitpass: "#e6441f",
  flexone: "#8f499c",
  go_for_eat: "#f59100",
  up_gift: "#738c8a",
  up_expense: "#0772f8",
  cheque_dejeuner: "#79bae3",
};

const GYM_PIN_COLOR = PRODUCT_COLORS.fitpass;

/**
 * Darkest circle fill per main pin color (`*-primary-1` style from `_variables.scss`).
 */
const PIN_CIRCLE_FILL_BY_MAIN_HEX: Record<string, string> = {
  [PRODUCT_COLORS.fitpass.toLowerCase()]: "#2e0d05",
  [PRODUCT_COLORS.flexone.toLowerCase()]: "#201023",
  [PRODUCT_COLORS.go_for_eat.toLowerCase()]: "#331b00",
  [PRODUCT_COLORS.up_gift.toLowerCase()]: "#171c1c",
  [PRODUCT_COLORS.up_expense.toLowerCase()]: "#011732",
  [PRODUCT_COLORS.cheque_dejeuner.toLowerCase()]: "#071e2c",
};

const CATEGORY_SELECTED_PIN_FILL: Record<CategoryId, string> = {
  meal: "#ff8500",
  gyms: "#e6441f",
  expenses: "#0772f8",
  rewards: "#738c8a",
};

const circleFillForMainColor = (mainHex: string): string => {
  const key = mainHex.trim().toLowerCase();
  return PIN_CIRCLE_FILL_BY_MAIN_HEX[key] ?? key;
};

const resolveMerchantProducts = (properties: Record<string, unknown>): ProductDotKey[] => {
  const products = new Set<ProductDotKey>();
  for (const id of resolveMerchantProductIdsFromProperties(properties)) {
    if (id === "fitpass") products.add("fitpass");
    if (id === "flexone") products.add("flexone");
    if (id === "go-for-eat") products.add("go_for_eat");
    if (id === "up-gift") products.add("up_gift");
    if (id === "up-expense") products.add("up_expense");
    if (id === "cheque-dejeuner") products.add("cheque_dejeuner");
  }

  return PRODUCT_DOT_ORDER.filter((p) => products.has(p));
};

const getMccMarkerIcon = (properties: Record<string, unknown>): MarkerCategoryIconKey => {
  const categoryText = String(
    properties.MCCCategory_EN ??
      properties.MCCCategoryEN ??
      properties.MCCCategoryGR ??
      "",
  ).toLowerCase();
  const brandText = String(
    properties.BrandName_EN ??
      properties.BrandNameEN ??
      properties.BrandName_GR ??
      properties.BrandNameGR ??
      "",
  ).toLowerCase();
  const searchText = `${categoryText} ${brandText}`;

  if (resolveMerchantCategoryFromProperties(properties) === "gyms") {
    return ICONS.BARBELL;
  }
  if (
    searchText.includes("pharmacy") ||
    searchText.includes("φαρμακ") ||
    searchText.includes("drugstore")
  ) {
    return ICONS.ASCLEPIUS;
  }
  if (
    searchText.includes("coffee") ||
    searchText.includes("cafe") ||
    searchText.includes("café") ||
    searchText.includes("καφε")
  ) {
    return ICONS.COFFEE;
  }
  if (
    searchText.includes("bakery") ||
    searchText.includes("pastry") ||
    searchText.includes("bread") ||
    searchText.includes("φουρ")
  ) {
    return ICONS.COOKIE;
  }
  if (
    searchText.includes("supermarket") ||
    searchText.includes("super market") ||
    searchText.includes("grocery") ||
    searchText.includes("market") ||
    searchText.includes("παντοπωλ") ||
    searchText.includes("σουπερ")
  ) {
    return ICONS.BASKET;
  }
  if (
    searchText.includes("restaurant") ||
    searchText.includes("food") ||
    searchText.includes("eat") ||
    searchText.includes("φαγη") ||
    searchText.includes("εστιατορ") ||
    searchText.includes("σουβλα")
  ) {
    return ICONS.FORK_KNIFE;
  }
  return ICONS.STOREFRONT;
};

export type MarkerVisual = {
  iconKey: MarkerCategoryIconKey;
  mainColor: string;
  circleFill: string;
  selectedPinFill: string;
  products: ProductDotKey[];
};

export const resolveMarkerVisual = (properties: Record<string, unknown>): MarkerVisual => {
  const iconKey = getMccMarkerIcon(properties);
  const products = resolveMerchantProducts(properties);
  const category = resolveMerchantCategoryFromProperties(properties);
  const isGym = category === "gyms";

  let mainColor = PRODUCT_COLORS.go_for_eat;
  if (isGym) {
    mainColor = GYM_PIN_COLOR;
  } else {
    if (products.includes("go_for_eat")) mainColor = PRODUCT_COLORS.go_for_eat;
    else if (products.includes("up_gift")) mainColor = PRODUCT_COLORS.up_gift;
    else if (products.includes("up_expense")) mainColor = PRODUCT_COLORS.up_expense;
    else if (products.includes("flexone")) mainColor = PRODUCT_COLORS.flexone;
    else if (products.includes("cheque_dejeuner")) mainColor = PRODUCT_COLORS.cheque_dejeuner;
  }

  const circleFill = circleFillForMainColor(mainColor);
  const selectedPinFill = CATEGORY_SELECTED_PIN_FILL[category];

  return {
    iconKey,
    mainColor,
    circleFill,
    selectedPinFill,
    products: products.slice(0, 6),
  };
};

export const buildMarkerIconId = (
  iconKey: MarkerGlyphKey,
  mainColor: string,
  circleFill: string,
  products: ProductDotKey[],
): string => {
  const mainTag = mainColor.replace("#", "");
  const fillTag = circleFill.replace("#", "");
  const productsTag = products.join("-") || "none";
  return `merchant-marker-${iconKey}-${mainTag}-${fillTag}-${productsTag}-pincat`;
};

export const buildActiveMarkerIconId = (selectedPinFill: string, products: ProductDotKey[]): string => {
  const fillTag = selectedPinFill.replace("#", "");
  const productsTag = products.join("-") || "none";
  return `merchant-marker-map-pin-sel-${fillTag}-${productsTag}-pincatm2`;
};

export const withClientIds = (features: PartnerFeature[]): PartnerFeature[] =>
  features.map((feature) => {
    const visual = resolveMarkerVisual(feature.properties);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        __merchant_id: getPartnerId(feature),
        __marker_icon: buildMarkerIconId(
          visual.iconKey,
          visual.mainColor,
          visual.circleFill,
          visual.products,
        ),
        __marker_icon_active: buildActiveMarkerIconId(visual.selectedPinFill, visual.products),
        __marker_dot_color: visual.mainColor,
        __marker_icon_key: visual.iconKey,
        __marker_icon_color: visual.mainColor,
        __marker_products: visual.products.join(","),
      },
    };
  });
