import {
  resolveMerchantCategorization,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";
import type { CategoryId } from "@/types";

type MerchantCategorizationFixture = {
  name: string;
  properties: Record<string, unknown>;
  expectedPrimaryCategoryId: MerchantCategoryId;
  expectedNetworkCategoryId: CategoryId;
};

export const MERCHANT_CATEGORIZATION_FIXTURES: MerchantCategorizationFixture[] = [
  {
    name: "Pharmacy MCC stays pharmacy, not broad health",
    properties: {
      ID: "fixture-pharmacy",
      BrandNameEN: "Central Pharmacy",
      MCCCategoryEN: "Pharmacy",
      AcceptedProducts: "FlexOne",
    },
    expectedPrimaryCategoryId: "pharmacy",
    expectedNetworkCategoryId: "rewards",
  },
  {
    name: "Fitpass gym gets gym as primary",
    properties: {
      ID: "fixture-gym",
      BrandNameEN: "North Fitness Club",
      MCCCategoryEN: "Fitness and gyms",
      AcceptedProducts: "Fitpass",
    },
    expectedPrimaryCategoryId: "gym",
    expectedNetworkCategoryId: "gyms",
  },
  {
    name: "Fuel station maps to expenses",
    properties: {
      ID: "fixture-fuel",
      BrandNameEN: "Fuel Station",
      MCCCategoryEN: "Petrol and gas station",
      AcceptedProducts: "Up Expense",
    },
    expectedPrimaryCategoryId: "fuel",
    expectedNetworkCategoryId: "expenses",
  },
  {
    name: "Coffee shop chooses coffee over generic restaurant",
    properties: {
      ID: "fixture-coffee",
      BrandNameEN: "Daily Espresso Cafe",
      MCCCategoryEN: "Coffee shop",
      AcceptedProducts: "go for EAT",
    },
    expectedPrimaryCategoryId: "coffee",
    expectedNetworkCategoryId: "meal",
  },
];

export const validateMerchantCategorizationFixtures = (): string[] =>
  MERCHANT_CATEGORIZATION_FIXTURES.flatMap((fixture) => {
    const actual = resolveMerchantCategorization(fixture.properties);
    const failures: string[] = [];

    if (actual.primaryCategoryId !== fixture.expectedPrimaryCategoryId) {
      failures.push(
        `${fixture.name}: expected primary ${fixture.expectedPrimaryCategoryId}, got ${actual.primaryCategoryId}`,
      );
    }

    if (actual.networkCategoryId !== fixture.expectedNetworkCategoryId) {
      failures.push(
        `${fixture.name}: expected network ${fixture.expectedNetworkCategoryId}, got ${actual.networkCategoryId}`,
      );
    }

    return failures;
  });

