import type { ILocale } from "./ILocale";
import type { PartnerFeature } from "./IMerchant";

export type MerchantDetailSheetLabels = {
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
  goForEat: string;
  fitpass: string;
  upExpense: string;
  upMeal: string;
  upGift: string;
  digitalOnly: string;
  photos?: string;
};

export type MerchantDetailSheetProps = {
  partner: PartnerFeature | null;
  isMobile?: boolean;
  locale: ILocale;
  labels: MerchantDetailSheetLabels;
  onClose: () => void;
  closeSignal?: number;
};

export type VisiblePartnersChangePayload = {
  partners: PartnerFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
  error: string | null;
};
