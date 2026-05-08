import { useCallback, useMemo, useState } from "react";
import type { MerchantFeature } from "@/types";
import {
  buildNetworkFilterOptions,
  merchantMatchesFilters as merchantPassesFilters,
} from "@/lib/merchantFilters";

export function useMerchantFilters(allKnownMerchants: MerchantFeature[]) {
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const networkFilterOptions = useMemo(
    () => buildNetworkFilterOptions(allKnownMerchants),
    [allKnownMerchants],
  );

  const merchantMatchesFilters = useCallback(
    (merchant: MerchantFeature) =>
      merchantPassesFilters(merchant, selectedNetworkIds),
    [selectedNetworkIds],
  );

  const activeFilterCount = selectedNetworkIds.length;

  const toggleNetwork = useCallback((id: string) => {
    setSelectedNetworkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedNetworkIds([]);
  }, []);

  return {
    selectedNetworkIds,
    setSelectedNetworkIds,
    isFiltersOpen,
    setIsFiltersOpen,
    networkFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleNetwork,
    clearAllFilters,
  };
}
