import type { MerchantCategoryId } from "@/lib/merchantCategorization";

export type MerchantCategoryOverride = {
  primaryCategoryId: MerchantCategoryId;
  secondaryCategoryIds?: MerchantCategoryId[];
};

// Add confirmed corrections here by stable merchant id first, then by VAT/name key
// only when an id is not available from the source data.
export const MERCHANT_CATEGORY_OVERRIDES: Record<string, MerchantCategoryOverride> = {};

