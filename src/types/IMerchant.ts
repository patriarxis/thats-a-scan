import { LOCALE } from "../enums";
import { ILocale } from "./ILocale";

export type PartnerProperties = {
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

export type PartnerFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: PartnerProperties;
};

export type PartnerFeatureCollection = {
  type: "FeatureCollection";
  features: PartnerFeature[];
};

export type MapBoundsPayload = {
  north_west: { latitude: number; longitude: number };
  south_east: { latitude: number; longitude: number };
};

export const getPartnerId = (feature: PartnerFeature): string =>
  String(
    feature.properties.ID ??
      feature.properties.MerchantId ??
      feature.properties.mongo_id ??
      `${feature.geometry.coordinates[0]}:${feature.geometry.coordinates[1]}`
  );

export function getLocalizedField(
  props: PartnerProperties,
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
    const value = props?.[key as keyof PartnerProperties];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export const getPartnerName = (feature: PartnerFeature, locale: ILocale): string =>
  String(
    getLocalizedField(feature.properties, "BrandName", locale) ||
      getLocalizedField(feature.properties, "VATName", locale) ||
      (locale === LOCALE.EL ? "Κατάστημα" : "Store")
  );

export const getPartnerAddress = (feature: PartnerFeature, locale: ILocale): string => {
  const address = getLocalizedField(feature.properties, "Address", locale);
  const town = getLocalizedField(feature.properties, "Town", locale);
  const district = getLocalizedField(feature.properties, "District", locale);
  const region = getLocalizedField(feature.properties, "Region", locale);
  const zip = feature.properties.ZIPCode;
  return [address, town, district, region, zip].filter(Boolean).join(", ");
};

const DIGITAL_NAME_HINTS = ["betterself", "online", "digital"];

export const isPartnerDigitalFromProperties = (properties: PartnerProperties): boolean => {
  const explicitDigitalFlag = [
    properties.IsDigital,
    properties.isDigital,
    properties.DigitalOnly,
    properties.digitalOnly,
    properties.IsOnline,
    properties.isOnline,
  ].some((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "online", "digital"].includes(normalized);
  });
  if (explicitDigitalFlag) return true;

  const venueType = String(properties.VenueType ?? properties.venueType ?? "")
    .trim()
    .toLowerCase();
  if (["digital", "online", "virtual"].includes(venueType)) return true;

  const nameBlob = [
    properties.BrandNameEN,
    properties.BrandNameGR,
    properties.VATNameEN,
    properties.VATNameGR,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  return DIGITAL_NAME_HINTS.some((hint) => nameBlob.includes(hint));
};

export const isPartnerDigital = (feature: PartnerFeature): boolean =>
  isPartnerDigitalFromProperties(feature.properties);

export type MerchantProperties = PartnerProperties;
export type MerchantFeature = PartnerFeature;
export type MerchantFeatureCollection = PartnerFeatureCollection;
export const getMerchantId = getPartnerId;
export const getMerchantName = getPartnerName;
export const getMerchantAddress = getPartnerAddress;
