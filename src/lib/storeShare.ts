import {
  getPartnerAddress,
  getPartnerId,
  getPartnerName,
  type PartnerFeature,
} from "@/types";
import { LOCALE } from "@/enums";
import { resolveMerchantCategoryFromProperties } from "@/lib/merchantFilters";
import { getStoreSeoText } from "@/lib/seo";

const STORE_LOOKUP_API_URL = "https://merchants-map.uphellas.gr/geojson/search";

export const parseCoordinate = (value?: string): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const buildStoreUrl = (
  storeId: string,
  lat?: string,
  lng?: string,
  locale: LOCALE = LOCALE.EL,
): string => {
  const params = new URLSearchParams();
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  const query = params.toString();
  const localePrefix = locale === LOCALE.EN ? "/en" : "";
  const pathname = `${localePrefix}/place/${encodeURIComponent(storeId)}`;
  return query ? `${pathname}?${query}` : pathname;
};

export const buildStoreOgImageUrl = (
  storeId: string,
  lat?: string,
  lng?: string,
  locale: LOCALE = LOCALE.EL,
): string => {
  const params = new URLSearchParams({ placeId: storeId });
  if (lat) params.set("lat", lat);
  if (lng) params.set("lng", lng);
  params.set("locale", locale);
  return `/api/og/place?${params.toString()}`;
};

export const fetchStoreDetails = async (
  storeId: string,
  lat: number,
  lng: number,
): Promise<PartnerFeature | null> => {
  const span = 0.03;
  const payload = {
    north_west: { latitude: lat + span, longitude: lng - span },
    south_east: { latitude: lat - span, longitude: lng + span },
  };

  try {
    const response = await fetch(STORE_LOOKUP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { features?: PartnerFeature[] };
    const features = Array.isArray(json.features) ? json.features : [];
    return features.find((feature) => getPartnerId(feature) === storeId) ?? null;
  } catch {
    return null;
  }
};

export const getStoreShareText = (
  storeId: string,
  store: PartnerFeature | null,
  locale: LOCALE = LOCALE.EL,
) => {
  if (!store) {
    const seoText = getStoreSeoText(locale, storeId, "", "");
    return {
      title: `${seoText.fallbackTitlePrefix} ${storeId} | ${seoText.titleSuffix}`,
      description: seoText.fallbackDescription,
      address: "",
      category: "rewards" as const,
    };
  }

  const name = getPartnerName(store, locale);
  const address = getPartnerAddress(store, locale);
  const { title, description } = getStoreSeoText(locale, storeId, name, address);
  const category = resolveMerchantCategoryFromProperties(store.properties);

  return { title, description, address, category };
};
