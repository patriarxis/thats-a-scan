import { LOCALE } from "../enums";
import { ILocale } from "./ILocale";

export type MerchantProperties = {
  ID?: string | number;
  MerchantId?: string | number;
  BrandNameGR?: string;
  BrandNameEN?: string;
  VATNameGR?: string;
  VATNameEN?: string;
  AddressGR?: string;
  AddressEN?: string;
  TownGR?: string;
  TownEN?: string;
  DistrictGR?: string;
  DistrictEN?: string;
  RegionGR?: string;
  RegionEN?: string;
  MCCCategoryGR?: string;
  MCCCategoryEN?: string;
  ZIPCode?: string | number;
  [key: string]: unknown;
};

export type MerchantFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: MerchantProperties;
};

export type MerchantFeatureCollection = {
  type: "FeatureCollection";
  features: MerchantFeature[];
};

export type MapBoundsPayload = {
  north_west: { latitude: number; longitude: number };
  south_east: { latitude: number; longitude: number };
};

export const getMerchantId = (feature: MerchantFeature): string =>
  String(
    feature.properties.ID ??
      feature.properties.MerchantId ??
      feature.properties.mongo_id ??
      `${feature.geometry.coordinates[0]}:${feature.geometry.coordinates[1]}`
  );

export function getLocalizedField(
  props: MerchantProperties,
  baseKey:
    | "BrandName"
    | "VATName"
    | "Address"
    | "Town"
    | "District"
    | "Region"
    | "MCCCategory",
  locale: ILocale
): string {
  const suffixPrimary = locale === LOCALE.EL ? "GR" : "EN";
  const suffixFallback = locale === LOCALE.EL ? "EN" : "GR";

  const candidates = [
    `${baseKey}${suffixPrimary}`,
    `${baseKey}_${suffixPrimary}`,
    `${baseKey}${suffixFallback}`,
    `${baseKey}_${suffixFallback}`,
    baseKey
  ] as const;

  for (const key of candidates) {
    const value = props?.[key as keyof MerchantProperties];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export const getMerchantName = (feature: MerchantFeature, locale: ILocale): string =>
  String(
    getLocalizedField(feature.properties, "BrandName", locale) ||
      getLocalizedField(feature.properties, "VATName", locale) ||
      (locale === LOCALE.EL ? "Κατάστημα" : "Store")
  );

export const getMerchantAddress = (feature: MerchantFeature, locale: ILocale): string => {
  const address = getLocalizedField(feature.properties, "Address", locale);
  const town = getLocalizedField(feature.properties, "Town", locale);
  const district = getLocalizedField(feature.properties, "District", locale);
  const region = getLocalizedField(feature.properties, "Region", locale);
  const zip = feature.properties.ZIPCode;
  return [address, town, district, region, zip].filter(Boolean).join(", ");
};
