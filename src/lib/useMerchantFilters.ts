import { useCallback, useMemo, useState } from "react";
import type { CategoryId, MerchantFeature } from "@/types";
import {
  buildProductFilterOptions,
  merchantMatchesFilters as merchantPassesFilters,
} from "@/lib/merchantFilters";

export function useMerchantFilters(allKnownMerchants: MerchantFeature[]) {
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<CategoryId[]>([]);
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
        selectedNetworkIds,
        selectedProductIds,
        cashbackOnly,
      ),
    [cashbackOnly, selectedNetworkIds, selectedProductIds],
  );

  const activeFilterCount =
    selectedNetworkIds.length + selectedProductIds.length + (cashbackOnly ? 1 : 0);

  const toggleNetwork = useCallback((id: CategoryId) => {
    setSelectedNetworkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedNetworkIds([]);
    setSelectedProductIds([]);
    setCashbackOnly(false);
  }, []);

  return {
    selectedNetworkIds,
    selectedProductIds,
    cashbackOnly,
    isFiltersOpen,
    setIsFiltersOpen,
    setCashbackOnly,
    productFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleNetwork,
    toggleProduct,
    clearAllFilters,
  };
}
