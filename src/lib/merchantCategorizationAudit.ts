import type { MerchantFeature } from "@/types";
import { getMerchantId } from "@/types";
import {
  MERCHANT_CATEGORY_DEFINITIONS,
  buildMerchantCategoryFields,
  inferBestCategory,
  resolveMerchantCategorization,
  scoreMerchantCategoriesByField,
  type MerchantCategorization,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";

export type MerchantCategorizationAuditRow = {
  merchantId: string;
  primaryCategoryId: MerchantCategoryId;
  secondaryCategoryIds: MerchantCategoryId[];
  networkCategoryId: MerchantCategorization["networkCategoryId"];
  confidence: MerchantCategorization["confidence"];
  mccCategoryId: MerchantCategoryId | null;
  nameCategoryId: MerchantCategoryId | null;
  mccNameConflict: boolean;
  resolution: string | null;
  topEvidence: MerchantCategorization["evidence"];
};

export type MerchantCategorizationAudit = {
  total: number;
  lowConfidence: MerchantCategorizationAuditRow[];
  mccNameConflicts: MerchantCategorizationAuditRow[];
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

const extractResolution = (evidence: MerchantCategorization["evidence"]): string | null => {
  const resolution = evidence.find((entry) =>
    entry.matches.some((match) => match.startsWith("resolution:")),
  );
  if (!resolution) return null;
  return resolution.matches.find((match) => match.startsWith("resolution:")) ?? null;
};

export const buildMerchantCategorizationAudit = (
  merchants: MerchantFeature[],
): MerchantCategorizationAudit => {
  const countsByPrimaryCategory = { ...EMPTY_CATEGORY_COUNTS };
  const rows = merchants.map((merchant) => {
    const categorization = resolveMerchantCategorization(merchant.properties);
    countsByPrimaryCategory[categorization.primaryCategoryId] += 1;

    const fields = buildMerchantCategoryFields(merchant.properties);
    const mccPick = inferBestCategory(scoreMerchantCategoriesByField(fields, "mcc"));
    const namePick = inferBestCategory(scoreMerchantCategoriesByField(fields, "name"));
    const mccCategoryId = mccPick?.categoryId ?? null;
    const nameCategoryId = namePick?.categoryId ?? null;
    const mccNameConflict =
      mccCategoryId !== null && nameCategoryId !== null && mccCategoryId !== nameCategoryId;

    return {
      merchantId: getMerchantId(merchant),
      primaryCategoryId: categorization.primaryCategoryId,
      secondaryCategoryIds: categorization.secondaryCategoryIds,
      networkCategoryId: categorization.networkCategoryId,
      confidence: categorization.confidence,
      mccCategoryId,
      nameCategoryId,
      mccNameConflict,
      resolution: extractResolution(categorization.evidence),
      topEvidence: categorization.evidence.slice(0, 5),
    };
  });

  return {
    total: merchants.length,
    lowConfidence: rows.filter((row) => row.confidence === "low"),
    mccNameConflicts: rows.filter((row) => row.mccNameConflict),
    countsByPrimaryCategory,
    rows,
  };
};
