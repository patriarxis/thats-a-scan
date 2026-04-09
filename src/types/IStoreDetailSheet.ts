import type { ILocale } from "./ILocale";
import type { PartnerFeature } from "./IMerchant";

export type PartnerDetailSheetLabels = {
  merchantDetail: string;
  close: string;
  address: string;
  noAddress: string;
  openMaps: string;
  share: string;
  phone: string;
  website: string;
  facebook: string;
  linkedin: string;
  instagram: string;
  description: string;
  cashback: string;
  flexone: string;
  categoryMeal: string;
};

export type PartnerDetailSheetProps = {
  partner: PartnerFeature | null;
  isMobile?: boolean;
  locale: ILocale;
  labels: PartnerDetailSheetLabels;
  onClose: () => void;
};

export type VisiblePartnersChangePayload = {
  partners: PartnerFeature[];
  loading: boolean;
  updating: boolean;
  error: string | null;
};

// Backward-compatible aliases during migration.
export type StoreDetailSheetLabels = PartnerDetailSheetLabels;
export type StoreDetailSheetProps = {
  merchant: PartnerFeature | null;
  isMobile?: boolean;
  locale: ILocale;
  labels: StoreDetailSheetLabels;
  onClose: () => void;
};
export type VisibleMerchantsChangePayload = {
  merchants: PartnerFeature[];
  loading: boolean;
  updating: boolean;
  error: string | null;
};
