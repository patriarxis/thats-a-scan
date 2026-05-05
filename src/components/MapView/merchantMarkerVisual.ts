import { ICONS } from "@/enums";
import {
  resolveMerchantAcceptedProductIdsFromProperties,
} from "@/lib/merchantFilters";
import {
  getMerchantCategoryIcon,
  resolveMerchantCategorization,
} from "@/lib/merchantCategorization";
import {
  getPartnerId,
  isPartnerDigitalFromProperties,
  type CategoryId,
  type PartnerFeature,
} from "@/types";

export type MarkerCategoryIconKey =
  | ICONS.BARBELL
  | ICONS.BASKET
  | ICONS.BED
  | ICONS.BOOK_OPEN_TEXT
  | ICONS.BRIEFCASE
  | ICONS.BUILDINGS
  | ICONS.BUS
  | ICONS.CAR
  | ICONS.CHILDCARE
  | ICONS.FORK_KNIFE
  | ICONS.COFFEE
  | ICONS.COOKIE
  | ICONS.ASCLEPIUS
  | ICONS.FIRST_AID_KIT
  | ICONS.FLOWER_LOTUS
  | ICONS.GAS_PUMP
  | ICONS.MARTINI
  | ICONS.PALETTE
  | ICONS.POPCORN
  | ICONS.SHIELD_CHECK
  | ICONS.SHOPPING_BAG
  | ICONS.STOREFRONT;

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

const NETWORK_PIN_COLORS: Record<CategoryId, string> = {
  meal: PRODUCT_COLORS.go_for_eat,
  gyms: PRODUCT_COLORS.fitpass,
  expenses: PRODUCT_COLORS.up_expense,
  rewards: PRODUCT_COLORS.up_gift,
};

const PIN_CIRCLE_FILL_BY_MAIN_HEX: Record<string, string> = {
  [PRODUCT_COLORS.fitpass.toLowerCase()]: "#2e0d05",
  [PRODUCT_COLORS.flexone.toLowerCase()]: "#201023",
  [PRODUCT_COLORS.go_for_eat.toLowerCase()]: "#331b00",
  [PRODUCT_COLORS.up_gift.toLowerCase()]: "#171c1c",
  [PRODUCT_COLORS.up_expense.toLowerCase()]: "#011732",
  [PRODUCT_COLORS.cheque_dejeuner.toLowerCase()]: "#071e2c",
};

const CATEGORY_SELECTED_PIN_FILL: Record<CategoryId, string> = {
  meal: PRODUCT_COLORS.go_for_eat,
  gyms: PRODUCT_COLORS.fitpass,
  expenses: "#0772f8",
  rewards: "#738c8a",
};

const circleFillForMainColor = (mainHex: string): string => {
  const key = mainHex.trim().toLowerCase();
  return PIN_CIRCLE_FILL_BY_MAIN_HEX[key] ?? key;
};

const resolveMerchantProducts = (properties: Record<string, unknown>): ProductDotKey[] => {
  const products = new Set<ProductDotKey>();
  for (const id of resolveMerchantAcceptedProductIdsFromProperties(properties)) {
    if (id === "fitpass") products.add("fitpass");
    if (id === "flexone") products.add("flexone");
    if (id === "go-for-eat") products.add("go_for_eat");
    if (id === "up-gift") products.add("up_gift");
    if (id === "cheque-dejeuner") products.add("cheque_dejeuner");
  }

  return PRODUCT_DOT_ORDER.filter((p) => products.has(p));
};

export type MarkerVisual = {
  iconKey: MarkerCategoryIconKey;
  mainColor: string;
  circleFill: string;
  selectedPinFill: string;
  products: ProductDotKey[];
  isDigital: boolean;
};

export const resolveMarkerVisual = (properties: Record<string, unknown>): MarkerVisual => {
  const isDigital = isPartnerDigitalFromProperties(properties);
  const categorization = resolveMerchantCategorization(properties);
  const iconKey = (
    isDigital ? ICONS.STOREFRONT : getMerchantCategoryIcon(categorization.primaryCategoryId)
  ) as MarkerCategoryIconKey;
  const products = resolveMerchantProducts(properties);
  const category = categorization.networkCategoryId;
  const mainColor = NETWORK_PIN_COLORS[category];

  const circleFill = circleFillForMainColor(mainColor);
  const selectedPinFill = CATEGORY_SELECTED_PIN_FILL[category];

  return {
    iconKey,
    mainColor,
    circleFill,
    selectedPinFill,
    products: products.slice(0, 6),
    isDigital,
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
        __marker_is_digital: visual.isDigital ? "1" : "0",
      },
    };
  });
