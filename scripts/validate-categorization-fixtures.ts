import { validateMerchantCategorizationFixtures } from "../src/lib/merchantCategorization.fixtures";

const failures = validateMerchantCategorizationFixtures();

if (failures.length > 0) {
  console.error("Merchant categorization fixture failures:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("All merchant categorization fixtures passed.");
