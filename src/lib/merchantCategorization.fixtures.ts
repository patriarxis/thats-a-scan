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
    name: "Nyamie venue is always gym",
    properties: {
      ID: "fixture-nyamie",
      __source: "nyamie",
      BrandNameEN: "Any Studio",
      MCCCategoryEN: "Pilates",
    },
    expectedPrimaryCategoryId: "gym",
    expectedNetworkCategoryId: "gyms",
  },
  {
    name: "Up Hellas wrong MCC overridden by supermarket name",
    properties: {
      ID: "fixture-supermarket-override",
      __source: "up_hellas",
      BrandNameEN: "Sklavenitis",
      MCCCategoryEN: "Fitness and gyms",
      AcceptedProducts: "go for EAT",
    },
    expectedPrimaryCategoryId: "supermarket",
    expectedNetworkCategoryId: "meal",
  },
  {
    name: "Up Hellas correct MCC kept for supermarket",
    properties: {
      ID: "fixture-supermarket-mcc",
      __source: "up_hellas",
      BrandNameEN: "Local Store",
      MCCCategoryEN: "Supermarket",
      AcceptedProducts: "go for EAT",
    },
    expectedPrimaryCategoryId: "supermarket",
    expectedNetworkCategoryId: "meal",
  },
  {
    name: "Pharmacy MCC falls back to shopping",
    properties: {
      ID: "fixture-pharmacy",
      BrandNameEN: "Central Pharmacy",
      MCCCategoryEN: "Pharmacy",
      AcceptedProducts: "FlexOne",
    },
    expectedPrimaryCategoryId: "shopping",
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
    name: "Fuel station falls back to shopping",
    properties: {
      ID: "fixture-fuel",
      BrandNameEN: "Fuel Station",
      MCCCategoryEN: "Petrol and gas station",
      AcceptedProducts: "Up Expense",
    },
    expectedPrimaryCategoryId: "shopping",
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
