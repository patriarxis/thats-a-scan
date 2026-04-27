import type { MerchantFeature } from "@/types";
import { getMerchantId } from "@/types";
import {
  MERCHANT_CATEGORY_DEFINITIONS,
  resolveMerchantCategorization,
  type MerchantCategorization,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";

export type MerchantCategorizationAuditRow = {
  merchantId: string;
  primaryCategoryId: MerchantCategoryId;
  secondaryCategoryIds: MerchantCategoryId[];
  networkCategoryId: MerchantCategorization["networkCategoryId"];
  confidence: MerchantCategorization["confidence"];
  topEvidence: MerchantCategorization["evidence"];
};

export type MerchantCategorizationAudit = {
  total: number;
  lowConfidence: MerchantCategorizationAuditRow[];
  countsByPrimaryCategory: Record<MerchantCategoryId, number>;
  rows: MerchantCategorizationAuditRow[];
};

const EMPTY_CATEGORY_COUNTS = MERCHANT_CATEGORY_DEFINITIONS.reduce(
  (counts, definition) => {
    counts[definition.id] = 0;
    return counts;
  },
  {} as Record<MerchantCategoryId, number>,
);

export const buildMerchantCategorizationAudit = (
  merchants: MerchantFeature[],
): MerchantCategorizationAudit => {
  const countsByPrimaryCategory = { ...EMPTY_CATEGORY_COUNTS };
  const rows = merchants.map((merchant) => {
    const categorization = resolveMerchantCategorization(merchant.properties);
    countsByPrimaryCategory[categorization.primaryCategoryId] += 1;

    return {
      merchantId: getMerchantId(merchant),
      primaryCategoryId: categorization.primaryCategoryId,
      secondaryCategoryIds: categorization.secondaryCategoryIds,
      networkCategoryId: categorization.networkCategoryId,
      confidence: categorization.confidence,
      topEvidence: categorization.evidence.slice(0, 3),
    };
  });

  return {
    total: merchants.length,
    lowConfidence: rows.filter((row) => row.confidence === "low"),
    countsByPrimaryCategory,
    rows,
  };
};

