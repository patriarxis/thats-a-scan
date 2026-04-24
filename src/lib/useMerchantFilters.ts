import { useCallback, useMemo, useState } from "react";
import type { MerchantFeature } from "@/types";
import {
  buildProductFilterOptions,
  merchantMatchesFilters as merchantPassesFilters,
} from "@/lib/merchantFilters";

export function useMerchantFilters(allKnownMerchants: MerchantFeature[]) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [cashbackOnly, setCashbackOnly] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const productFilterOptions = useMemo(
    () => buildProductFilterOptions(allKnownMerchants),
    [allKnownMerchants],
  );

  const merchantMatchesFilters = useCallback(
    (merchant: MerchantFeature) =>
      merchantPassesFilters(
        merchant,
        selectedProductIds,
        cashbackOnly,
      ),
    [cashbackOnly, selectedProductIds],
  );

  const activeFilterCount =
    selectedProductIds.length + 
    (cashbackOnly ? 1 : 0);

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedProductIds([]);
    setCashbackOnly(false);
  }, []);

  return {
    selectedProductIds,
    setSelectedProductIds,
    cashbackOnly,
    isFiltersOpen,
    setIsFiltersOpen,
    setCashbackOnly,
    productFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleProduct,
    clearAllFilters,
  };
}
