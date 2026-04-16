import { useCallback, useMemo, useState } from "react";
import type { CategoryId, MerchantFeature } from "@/types";
import {
  buildProductFilterOptions,
  buildWalletFilterOptions,
  merchantMatchesFilters as merchantPassesFilters,
} from "@/lib/merchantFilters";

export function useMerchantFilters(allKnownMerchants: MerchantFeature[]) {
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<CategoryId[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([]);
  const [cashbackOnly, setCashbackOnly] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const productFilterOptions = useMemo(
    () => buildProductFilterOptions(allKnownMerchants),
    [allKnownMerchants],
  );

  const walletFilterOptions = useMemo(
    () => buildWalletFilterOptions(),
    [],
  );

  const merchantMatchesFilters = useCallback(
    (merchant: MerchantFeature) =>
      merchantPassesFilters(
        merchant,
        selectedNetworkIds,
        selectedProductIds,
        selectedWalletIds,
        cashbackOnly,
      ),
    [cashbackOnly, selectedNetworkIds, selectedProductIds, selectedWalletIds],
  );

  const activeFilterCount =
    selectedNetworkIds.length + 
    selectedProductIds.length + 
    selectedWalletIds.length + 
    (cashbackOnly ? 1 : 0);

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

  const toggleWallet = useCallback((id: string) => {
    setSelectedWalletIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const toggleAllWallets = useCallback((active: boolean) => {
    if (active) {
      setSelectedWalletIds(walletFilterOptions.map((o) => o.id));
    } else {
      setSelectedWalletIds([]);
    }
  }, [walletFilterOptions]);

  const isFlexOneWalletActive =
    walletFilterOptions.length > 0 &&
    selectedWalletIds.length === walletFilterOptions.length;

  const clearAllFilters = useCallback(() => {
    setSelectedNetworkIds([]);
    setSelectedProductIds([]);
    setSelectedWalletIds([]);
    setCashbackOnly(false);
  }, []);

  return {
    selectedNetworkIds,
    selectedProductIds,
    selectedWalletIds,
    isFlexOneWalletActive,
    cashbackOnly,
    isFiltersOpen,
    setIsFiltersOpen,
    setCashbackOnly,
    productFilterOptions,
    walletFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleNetwork,
    toggleProduct,
    toggleWallet,
    toggleAllWallets,
    clearAllFilters,
  };
}
