import { useCallback, useMemo, useState } from "react";
import type { MerchantFeature } from "@/types";
import {
  buildNetworkFilterOptions,
  merchantMatchesFilters as merchantPassesFilters,
} from "@/lib/merchantFilters";

export function useMerchantFilters(allKnownMerchants: MerchantFeature[]) {
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [cashbackOnly, setCashbackOnly] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const networkFilterOptions = useMemo(
    () => buildNetworkFilterOptions(allKnownMerchants),
    [allKnownMerchants],
  );

  const merchantMatchesFilters = useCallback(
    (merchant: MerchantFeature) =>
      merchantPassesFilters(
        merchant,
        selectedNetworkIds,
        cashbackOnly,
      ),
    [cashbackOnly, selectedNetworkIds],
  );

  const activeFilterCount =
    selectedNetworkIds.length +
    (cashbackOnly ? 1 : 0);

  const toggleNetwork = useCallback((id: string) => {
    setSelectedNetworkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedNetworkIds([]);
    setCashbackOnly(false);
  }, []);

  return {
    selectedNetworkIds,
    setSelectedNetworkIds,
    cashbackOnly,
    isFiltersOpen,
    setIsFiltersOpen,
    setCashbackOnly,
    networkFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleNetwork,
    clearAllFilters,
  };
}
