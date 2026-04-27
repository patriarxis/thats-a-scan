import type { CategoryId, ILocale, MerchantFeature } from "@/types";
import { getMerchantAddress, getMerchantName } from "@/types";
import { normalizeStr } from "@/lib/stringUtils";

export type PopularSearchCategoryId =
  | "supermarket"
  | "restaurant"
  | "coffee"
  | "pharmacy"
  | "bakery"
  | "gym"
  | "wellness"
  | "mobility"
  | "learning"
  | "childcare"
  | "fuel"
  | "entertainment"
  | "office"
  | "culture"
  | "health"
  | "safety"
  | "shopping"
  | "bars"
  | "hotels"
  | "services";

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
  {
    id: "wellness",
    labels: { en: "Wellness", el: "Ευεξία" },
    helperText: { en: "Spa, beauty and wellness", el: "Spa, ομορφιά και ευεξία" },
    keywords: ["wellness", "spa", "beauty", "salon", "massage", "cosmetic", "ευεξια", "σπα", "ομορφια", "κομμωτηριο"],
    mappedNetworkId: "rewards",
  },
  {
    id: "mobility",
    labels: { en: "Mobility", el: "Μετακίνηση" },
    helperText: { en: "Transport and mobility services", el: "Μεταφορές και μετακίνηση" },
    keywords: ["mobility", "transport", "taxi", "bus", "scooter", "car rental", "rental", "μετακινηση", "μεταφορα", "ταξι"],
    mappedNetworkId: "expenses",
  },
  {
    id: "learning",
    labels: { en: "Learning", el: "Εκπαίδευση" },
    helperText: { en: "Books, schools and courses", el: "Βιβλία, σχολές και μαθήματα" },
    keywords: ["learning", "education", "school", "course", "books", "bookstore", "training", "εκπαιδευση", "σχολη", "βιβλια"],
    mappedNetworkId: "rewards",
  },
  {
    id: "childcare",
    labels: { en: "Childcare", el: "Φροντίδα παιδιού" },
    helperText: { en: "Kids, baby and childcare", el: "Παιδική φροντίδα, βρέφος και παιχνίδια" },
    keywords: ["childcare", "kids", "children", "baby", "nursery", "toys", "παιδι", "παιδικα", "βρεφος", "παιχνιδια"],
    mappedNetworkId: "rewards",
  },
  {
    id: "fuel",
    labels: { en: "Fuel", el: "Καύσιμα" },
    helperText: { en: "Fuel stations and petrol", el: "Πρατήρια και καύσιμα" },
    keywords: ["fuel", "gas", "petrol", "gas station", "station", "καυσιμα", "βενζινη", "πρατηριο"],
    mappedNetworkId: "expenses",
  },
  {
    id: "entertainment",
    labels: { en: "Entertainment", el: "Ψυχαγωγία" },
    helperText: { en: "Cinema, games and leisure", el: "Σινεμά, παιχνίδια και διασκέδαση" },
    keywords: ["entertainment", "cinema", "movie", "games", "leisure", "bowling", "ψυχαγωγια", "σινεμα", "παιχνιδια"],
    mappedNetworkId: "rewards",
  },
  {
    id: "office",
    labels: { en: "Office", el: "Γραφείο" },
    helperText: { en: "Office, business and supplies", el: "Γραφείο, επιχειρήσεις και είδη" },
    keywords: ["office", "business", "supplies", "stationery", "printing", "coworking", "γραφειο", "επιχειρηση", "χαρτικα"],
    mappedNetworkId: "expenses",
  },
  {
    id: "culture",
    labels: { en: "Culture", el: "Πολιτισμός" },
    helperText: { en: "Museums, art and culture", el: "Μουσεία, τέχνη και πολιτισμός" },
    keywords: ["culture", "museum", "art", "gallery", "theater", "theatre", "music", "πολιτισμος", "μουσειο", "τεχνη", "θεατρο"],
    mappedNetworkId: "rewards",
  },
  {
    id: "health",
    labels: { en: "Health", el: "Υγεία" },
    helperText: { en: "Health and medical services", el: "Υγεία και ιατρικές υπηρεσίες" },
    keywords: ["health", "medical", "doctor", "clinic", "diagnostic", "dentist", "υγεια", "γιατρος", "ιατρ", "κλινικη"],
    mappedNetworkId: "rewards",
  },
  {
    id: "safety",
    labels: { en: "Safety", el: "Ασφάλεια" },
    helperText: { en: "Safety, insurance and security", el: "Ασφάλεια και προστασία" },
    keywords: ["safety", "security", "insurance", "protection", "locksmith", "ασφαλεια", "προστασια", "κλειδαρας"],
    mappedNetworkId: "expenses",
  },
  {
    id: "shopping",
    labels: { en: "Shopping", el: "Αγορές" },
    helperText: { en: "Retail stores and gifts", el: "Καταστήματα και δώρα" },
    keywords: ["shopping", "retail", "store", "shop", "gift", "mall", "αγορες", "καταστημα", "δωρα"],
    mappedNetworkId: "rewards",
  },
  {
    id: "bars",
    labels: { en: "Bars", el: "Μπαρ" },
    helperText: { en: "Bars and drinks", el: "Μπαρ και ποτά" },
    keywords: ["bar", "beer", "wine", "drink", "cocktail", "μπαρ", "ποτο", "ποτα", "κρασι"],
    mappedNetworkId: "meal",
  },
  {
    id: "hotels",
    labels: { en: "Hotels", el: "Ξενοδοχεία" },
    helperText: { en: "Hotels and accommodation", el: "Ξενοδοχεία και διαμονή" },
    keywords: ["hotel", "hostel", "accommodation", "lodging", "travel", "ξενοδοχειο", "διαμονη", "ταξιδι"],
    mappedNetworkId: "expenses",
  },
  {
    id: "services",
    labels: { en: "Services", el: "Υπηρεσίες" },
    helperText: { en: "Local and business services", el: "Τοπικές και επαγγελματικές υπηρεσίες" },
    keywords: ["service", "services", "repair", "cleaning", "local service", "υπηρεσια", "υπηρεσιες", "επισκευη"],
    mappedNetworkId: "expenses",
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
