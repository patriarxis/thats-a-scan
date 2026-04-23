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
  categoryRewards: string;
  categoryExpenses: string;
  categoryGyms: string;
  fitpass: string;
  upExpense: string;
  upMeal: string;
  upGift: string;
  photos?: string;
};

export type PartnerDetailSheetProps = {
  partner: PartnerFeature | null;
  isMobile?: boolean;
  locale: ILocale;
  labels: PartnerDetailSheetLabels;
  onClose: () => void;
  closeSignal?: number;
};

export type VisiblePartnersChangePayload = {
  partners: PartnerFeature[];
  loading: boolean;
  updating: boolean;
  error: string | null;
};
