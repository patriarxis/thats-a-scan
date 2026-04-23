"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { useLocale } from "@/lib";
import { useIsMobileUx } from "@/lib/useIsMobileUx";
import { LOCALE } from "@/enums";
import {
  type SearchSuggestion
} from "@/components/SearchBar/SearchBar";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import type { FiltersModalProps } from "@/components/FiltersModal/FiltersModal";
import { QuickFilterChips } from "@/components/QuickFilterChips/QuickFilterChips";
import { Backdrop } from "@/components/ui/Backdrop/Backdrop";
import type { MapViewHandle } from "@/components/MapView/MapView";
import { LocatorHeader } from "@/components/LocatorHeader/LocatorHeader";
import { LocatorFooter } from "@/components/LocatorFooter/LocatorFooter";
import { searchMerchantSuggestions } from "@/lib/merchantSearchIndex";
import {
  findPopularCategoriesForQuery,
  getPopularSearchCategories,
  merchantMatchesPopularCategory,
  type PopularSearchCategoryId,
} from "@/lib/searchCategories";
import { useMerchantFilters } from "@/lib/useMerchantFilters";
import {
  getPartnerId,
  type CategoryId,
  type PartnerFeature,
  type PartnerDetailSheetLabels,
  type VisiblePartnersChangePayload,
} from "@/types";
import {
  MERCHANT_SUGGESTION_LIMIT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SUGGESTION_LIMIT,
} from "@/lib/config";
import styles from "./LocatorPage.module.scss";

const MapView = dynamic(
  () => import("@/components/MapView/MapView").then((module) => module.MapView),
  { ssr: false },
);
const PartnerDetailSheet = dynamic(
  () =>
    import("@/components/PartnerDetailSheet/PartnerDetailSheet").then(
      (module) => module.PartnerDetailSheet,
    ),
  { ssr: false },
);

type UrlSelectionState = {
  storeId: string | null;
  lat: number;
  lng: number;
};

const parseSelectionFromLocation = (): UrlSelectionState => {
  if (typeof window === "undefined") {
    return { storeId: null, lat: Number.NaN, lng: Number.NaN };
  }
  const url = new URL(window.location.href);
  const pathMatch = url.pathname.match(/^\/store\/([^/]+)$/);
  const storeIdFromPath = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : null;
  const storeId = storeIdFromPath ?? url.searchParams.get("store");
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  return { storeId, lat, lng };
};

const LocatorPageContent = () => {
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapViewHandle | null>(null);
  const searchRequestRef = useRef(0);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const urlSelectionAppliedRef = useRef<string | null>(null);
  const isMobile = useIsMobileUx();
  const { locale, setLocale, t } = useLocale();
  const [urlSelection, setUrlSelection] = useState<UrlSelectionState>({
    storeId: null,
    lat: Number.NaN,
    lng: Number.NaN,
  });

  const [visiblePartners, setVisiblePartners] = useState<PartnerFeature[]>(
    [],
  );
  const [allKnownById, setAllKnownById] = useState<Record<string, PartnerFeature>
  >({});
  const [selectedPartner, setSelectedPartner] = useState<PartnerFeature | null>(null);
  const [sheetCloseSignal, setSheetCloseSignal] = useState(0);
  const [query, setQuery] = useState("");
  const [focusInputSignal, setFocusInputSignal] = useState(0);
  const [closeActiveSignal, setCloseActiveSignal] = useState(0);
  const [activeQuickCategoryId, setActiveQuickCategoryId] = useState<PopularSearchCategoryId | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapUpdating, setMapUpdating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const allKnownMerchants = useMemo(
    () => Object.values(allKnownById),
    [allKnownById],
  );
  const popularCategories = useMemo(() => getPopularSearchCategories(locale), [locale]);
  const quickChipOptions = useMemo(
    () =>
      popularCategories.map((category) => ({
        id: category.id,
        label: category.label,
      })),
    [popularCategories],
  );
  const recommendedCategorySuggestions = useMemo(
    () =>
      popularCategories.slice(0, SEARCH_SUGGESTION_LIMIT).map(
        (category) =>
          ({
            type: "category",
            id: `category:${category.id}`,
            label: category.label,
            sublabel: category.helperText,
            categoryId: category.id,
          }) satisfies SearchSuggestion,
      ),
    [popularCategories],
  );
  const activeQuickCategory = useMemo(
    () => popularCategories.find((item) => item.id === activeQuickCategoryId) ?? null,
    [activeQuickCategoryId, popularCategories],
  );
  const {
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
  } = useMerchantFilters(allKnownMerchants);

  const selectedId = selectedPartner ? getPartnerId(selectedPartner) : null;
  const sidebarOpen = !!selectedPartner;
  const desktopDrawerOffsetPx = 340;
  const mobileDrawerOffsetPx = 280;
  const closeFiltersToResults = useCallback(() => {
    setIsFiltersOpen(false);
    setSuggestions((prev) =>
      prev.length > 0 ? prev : recommendedCategorySuggestions,
    );
    setFocusInputSignal((value) => value + 1);
  }, [recommendedCategorySuggestions, setIsFiltersOpen]);
  const closeFiltersToDefault = useCallback(() => {
    setIsFiltersOpen(false);
    setCloseActiveSignal((value) => value + 1);
  }, [setIsFiltersOpen]);
  const handleOpenLanguageModal = useCallback(() => {
    closeFiltersToDefault();
    setIsLanguageModalOpen(true);
  }, [closeFiltersToDefault]);

  useEffect(() => {
    const syncFromBrowserLocation = () => {
      setUrlSelection(parseSelectionFromLocation());
    };
    syncFromBrowserLocation();
    window.addEventListener("popstate", syncFromBrowserLocation);
    return () => window.removeEventListener("popstate", syncFromBrowserLocation);
  }, []);

  useEffect(() => {
    if (!isFiltersOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (searchContainerRef.current?.contains(target)) return;
      closeFiltersToDefault();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [closeFiltersToDefault, isFiltersOpen]);

  const syncSelectionInUrl = useCallback(
    (partner: PartnerFeature | null, historyMode: "push" | "replace" = "replace") => {
      const currentUrl = new URL(window.location.href);
      const nextParams = new URLSearchParams(currentUrl.searchParams.toString());
      let nextPathname = "/";
      if (!partner) {
        nextParams.delete("store");
        nextParams.delete("lat");
        nextParams.delete("lng");
      } else {
        const [lng, lat] = partner.geometry.coordinates;
        const partnerId = getPartnerId(partner);
        nextParams.set("lat", String(lat));
        nextParams.set("lng", String(lng));
        nextParams.delete("store");
        nextPathname = `/store/${encodeURIComponent(partnerId)}`;
      }

      const nextQuery = nextParams.toString();
      const nextUrl = nextQuery ? `${nextPathname}?${nextQuery}` : nextPathname;
      if (historyMode === "push") {
        window.history.pushState(null, "", nextUrl);
      } else {
        window.history.replaceState(null, "", nextUrl);
      }
      setUrlSelection(parseSelectionFromLocation());
    },
    [],
  );

  const focusPadding = useMemo(() => {
    if (!sidebarOpen) {
      return { top: 64, right: 16, bottom: 16, left: 16 };
    }
    return {
      top: 64,
      right: 16,
      bottom: isMobile ? mobileDrawerOffsetPx : desktopDrawerOffsetPx,
      left: 16,
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!query.trim()) {
      geocodeAbortRef.current?.abort();
      setSuggestions(recommendedCategorySuggestions);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++searchRequestRef.current;
      geocodeAbortRef.current?.abort();
      setSearchLoading(true);

      const localMerchantResults = searchMerchantSuggestions(
        query,
        visiblePartners,
        locale,
        MERCHANT_SUGGESTION_LIMIT,
      );

      const globalMerchantResults = searchMerchantSuggestions(
        query,
        allKnownMerchants,
        locale,
        SEARCH_SUGGESTION_LIMIT,
      );

      const seenMerchantIds = new Set(localMerchantResults.map((item) => item.merchantId));
      const prioritizedMerchantResults = [
        ...localMerchantResults,
        ...globalMerchantResults.filter((item) => !seenMerchantIds.has(item.merchantId)),
      ].slice(0, MERCHANT_SUGGESTION_LIMIT);

      const merchantResults = prioritizedMerchantResults.map(
        (result) =>
          ({
            type: "merchant",
            id: result.id,
            label: result.label,
            sublabel: result.sublabel || t("noAddress"),
            merchantId: result.merchantId,
            coordinates: result.coordinates,
          }) satisfies SearchSuggestion,
      );
      const categoryResults = findPopularCategoriesForQuery(query, locale, 2).map(
        (category) =>
          ({
            type: "category",
            id: `category:${category.id}`,
            label: category.label,
            sublabel: category.helperText,
            categoryId: category.id,
          }) satisfies SearchSuggestion,
      );

      if (requestId === searchRequestRef.current) {
        setSuggestions([...categoryResults, ...merchantResults].slice(0, SEARCH_SUGGESTION_LIMIT));
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      geocodeAbortRef.current?.abort();
    };
  }, [allKnownMerchants, locale, query, recommendedCategorySuggestions, t, visiblePartners]);

  const highlightedPartnerIds = useMemo(
    () =>
      suggestions
        .filter(
          (item): item is SearchSuggestion & { merchantId: string } =>
            item.type === "merchant" && typeof item.merchantId === "string",
        )
        .map((item) => item.merchantId),
    [suggestions],
  );
  const showQuickChips = !query.trim() && !mapLoading && visiblePartners.length > 0;

  const merchantMatchesAllFilters = useCallback(
    (merchant: PartnerFeature) => {
      if (!merchantMatchesFilters(merchant)) return false;
      if (!activeQuickCategory) return true;
      return merchantMatchesPopularCategory(merchant, activeQuickCategory, locale);
    },
    [activeQuickCategory, locale, merchantMatchesFilters],
  );

  const handleSelectPartner = useCallback(
    (
      partner: PartnerFeature,
      options?: { updateUrl?: boolean; historyMode?: "push" | "replace" },
    ) => {
      setSelectedPartner(partner);
      mapRef.current?.panTo(partner.geometry.coordinates, {
        top: 64,
        right: 16,
        bottom: isMobile ? mobileDrawerOffsetPx : desktopDrawerOffsetPx,
        left: 16,
      });
      if (options?.updateUrl !== false) {
        syncSelectionInUrl(partner, options?.historyMode ?? "push");
      }
    },
    [isMobile, syncSelectionInUrl],
  );

  const clearSelectedPartner = useCallback(
    (historyMode: "push" | "replace" = "replace") => {
      setSelectedPartner(null);
      syncSelectionInUrl(null, historyMode);
    },
    [syncSelectionInUrl],
  );

  const requestCloseSelectedPartner = useCallback(() => {
    if (!selectedPartner) return;
    setSheetCloseSignal((value) => value + 1);
  }, [selectedPartner]);

  const handleVisiblePartnersChange = useCallback(
    ({ partners, loading, updating, error }: VisiblePartnersChangePayload) => {
      setVisiblePartners(partners);
      setMapLoading(loading);
      setMapUpdating(updating);
      setMapError(error);
      setAllKnownById((prev) => {
        const next = { ...prev };
        for (const partner of partners) {
          next[getPartnerId(partner)] = partner;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const { storeId, lat, lng } = urlSelection;
    const hasValidCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    if (!storeId) {
      urlSelectionAppliedRef.current = null;
      if (selectedPartner) {
        setSelectedPartner(null);
      }
      return;
    }

    const partner = allKnownById[storeId];
    if (partner) {
      if (selectedId !== storeId) {
        handleSelectPartner(partner, { updateUrl: false });
      }
      urlSelectionAppliedRef.current = storeId;
      return;
    }

    // Deep-link fallback: center to provided coordinates first while waiting for data.
    if (hasValidCoordinates && urlSelectionAppliedRef.current !== storeId) {
      mapRef.current?.flyTo([lng, lat], 15, focusPadding, { preserveHigherZoom: true });
      urlSelectionAppliedRef.current = storeId;
    }
  }, [
    allKnownById,
    focusPadding,
    handleSelectPartner,
    selectedId,
    selectedPartner,
    urlSelection,
  ]);

  const partnerDetailLabels: PartnerDetailSheetLabels = {
    merchantDetail: t("merchantDetail"),
    close: t("close"),
    address: t("address"),
    noAddress: t("noAddress"),
    openMaps: t("openMaps"),
    share: t("share"),
    phone: t("phone"),
    website: t("website"),
    facebook: t("facebook"),
    linkedin: t("linkedin"),
    instagram: t("instagram"),
    description: t("description"),
    cashback: t("cashback"),
    flexone: t("flexone"),
    categoryMeal: t("categoryMeal"),
    categoryRewards: t("categoryRewards"),
    categoryExpenses: t("categoryExpenses"),
    categoryGyms: t("categoryGyms"),
    fitpass: t("fitpass"),
    upExpense: t("upExpense"),
    upMeal: t("upMeal"),
    upGift: t("upGift"),
    photos: t("photos")
  };

  const filterLabels: Record<CategoryId, string> = {
    meal: t("categoryMeal"),
    rewards: t("categoryRewards"),
    expenses: t("categoryExpenses"),
    gyms: t("categoryGyms"),
  };

  const walletLabels: Record<string, string> = {
    meal: t("walletMeal"),
    rewards: t("walletRewards"),
    mobility: t("walletMobility"),
    public_transport: t("walletPublicTransport"),
    wellness: t("walletWellness"),
    learning: t("walletLearning"),
    vacations: t("walletVacations"),
    childcare: t("walletChildcare"),
    clothing: t("walletClothing"),
    beauty: t("walletBeauty"),
    wfh: t("walletWfh"),
    culture: t("walletCulture"),
    health: t("walletHealth"),
    safety: t("walletSafety"),
  };
  const filtersPanelProps: Omit<FiltersModalProps, "isOpen"> = {
    title: t("filters"),
    closeLabel: t("close"),
    networkCategoryLabel: t("networkCategory"),
    productLabel: t("product"),
    walletLabel: t("wallets"),
    walletFlexOneLabel: t("walletFlexOne"),
    cashbackLabel: t("cashback"),
    cashbackOnlyLabel: t("cashbackOnly"),
    clearAllFiltersLabel: t("clearAllFilters"),
    applyFiltersLabel: t("applyFilters"),
    noAvailableProductsLabel: t("noAvailableProducts"),
    networkLabels: filterLabels,
    walletLabels,
    selectedNetworkIds,
    selectedProductIds,
    selectedWalletIds,
    isFlexOneWalletActive,
    productOptions: productFilterOptions,
    walletOptions: walletFilterOptions,
    cashbackOnly,
    onClose: closeFiltersToResults,
    onToggleNetwork: toggleNetwork,
    onToggleProduct: toggleProduct,
    onToggleWallet: toggleWallet,
    onToggleAllWallets: toggleAllWallets,
    onToggleCashback: () => setCashbackOnly((prev) => !prev),
    onClearAll: clearAllFilters,
  };

  return (
    <div
      className={styles.root}
      data-sidebar-open={sidebarOpen ? "true" : "false"}
    >
      <MapView
        ref={mapRef}
        selectedPartnerId={selectedId}
        highlightedPartnerIds={highlightedPartnerIds}
        zoomInMessage={t("zoomInToSeeStores")}
        partnerFilter={merchantMatchesAllFilters}
        onPartnerSelect={handleSelectPartner}
        onVisiblePartnersChange={handleVisiblePartnersChange}
        onMapClick={requestCloseSelectedPartner}
      />

      {mapLoading && (
        <div className={styles.mapLoadingOverlay}>
          <div className={styles.mapLoadingLabel}>{t("loadingMap")}</div>
        </div>
      )}

      {mapError && <div className={styles.mapErrorOverlay}>{mapError}</div>}
      {!mapLoading && mapUpdating && !mapError && (
        <div className={styles.mapUpdatingChip}>{t("updatingArea")}</div>
      )}

      {!isMobile && <LocatorHeader locale={locale} onChangeLocale={setLocale} />}

      <div className={styles.searchOverlay}>
        <div
          ref={searchContainerRef}
          className={styles.searchContainer}
          data-filters-open={isFiltersOpen ? "true" : "false"}
        >
          <SearchBar
            value={query}
            suggestions={suggestions}
            suppressSuggestions={isLanguageModalOpen}
            placeholder={t("searchPlaceholder")}
            searchAriaLabel={t("searchAria")}
            clearAriaLabel={t("clearSearch")}
            openFiltersAriaLabel={t("openFilters")}
            showLocaleSwitcher={isMobile}
            localeSwitcherAriaLabel={t("language")}
            onOpenLocalePanel={handleOpenLanguageModal}
            filterActiveCount={activeFilterCount}
            categorySectionLabel={t("searchSectionCategories")}
            placeSectionLabel={t("searchSectionPlaces")}
            focusInputSignal={focusInputSignal}
            closeActiveSignal={closeActiveSignal}
            onCloseSearch={closeFiltersToDefault}
            isFiltersOpen={isFiltersOpen}
            filtersPanelProps={filtersPanelProps}
            onChange={(nextQuery) => {
              if (isFiltersOpen) {
                setIsFiltersOpen(false);
              }
              setQuery(nextQuery);
            }}
            onClear={() => {
              setQuery("");
              setSuggestions([]);
              setActiveQuickCategoryId(null);
            }}
            onSelect={(item) => {
              if (item.type === "category" && item.categoryId) {
                setActiveQuickCategoryId(item.categoryId as PopularSearchCategoryId);
                setQuery(item.label);
                setSuggestions([]);
                return;
              }
              if (!item.merchantId || !item.coordinates) return;
              const partner = allKnownById[item.merchantId];
              if (partner) {
                handleSelectPartner(partner);
              } else {
                mapRef.current?.panTo(item.coordinates, focusPadding);
              }
              setQuery(item.label);
              setSuggestions([]);
            }}
            onOpenFilters={() => setIsFiltersOpen(true)}
            onFocusInput={() => {
              if (isFiltersOpen) {
                setIsFiltersOpen(false);
              }
            }}
          />
        </div>

        {showQuickChips && (
          <div className={styles.filtersContainer}>
            <QuickFilterChips
              options={quickChipOptions}
              onToggle={(id) => {
                const nextId = id as PopularSearchCategoryId;
                setActiveQuickCategoryId((prev) => (prev === nextId ? null : nextId));
                const selectedCategory = popularCategories.find((item) => item.id === id);
                if (selectedCategory) {
                  setQuery(selectedCategory.label);
                }
              }}
            />
          </div>
        )}
      </div>
      {isMobile && (
        <Backdrop
          isOpen={isLanguageModalOpen}
          onClick={() => setIsLanguageModalOpen(false)}
          className={styles.languageModalOverlay}
          openClassName={styles.languageModalOverlayOpen}
          closingClassName={styles.languageModalOverlayClosing}
          exitDurationMs={180}
        >
          <div
            className={styles.languageModalActions}
            role="dialog"
            aria-modal="true"
            aria-label={t("language")}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`${styles.languageOption} ${locale === LOCALE.EL ? styles.languageOptionActive : ""}`}
              onClick={() => {
                setLocale(LOCALE.EL);
                setIsLanguageModalOpen(false);
              }}
            >
              ΕΛ
            </button>
            <button
              type="button"
              className={`${styles.languageOption} ${locale === LOCALE.EN ? styles.languageOptionActive : ""}`}
              onClick={() => {
                setLocale(LOCALE.EN);
                setIsLanguageModalOpen(false);
              }}
            >
              EN
            </button>
          </div>
        </Backdrop>
      )}
      <div
        className={styles.bottomDrawer}
        data-sheet-layout={isMobile ? "mobile" : "desktop"}
        aria-hidden={!sidebarOpen}
      >
        {selectedPartner && (
          <PartnerDetailSheet
            partner={selectedPartner}
            isMobile={isMobile}
            locale={locale}
            labels={partnerDetailLabels}
            onClose={() => clearSelectedPartner()}
            closeSignal={sheetCloseSignal}
          />
        )}
      </div>

      <LocatorFooter
        termsLabel={t("termsOfUse")}
        privacyLabel={t("privacyPolicy")}
        termsUrl={
          locale === "en"
            ? "https://uphellas.gr/en/terms-of-use"
            : "https://uphellas.gr/oroi-xrisis"
        }
        privacyUrl={
          locale === "en"
            ? "https://uphellas.gr/en/cookie-policy"
            : "https://uphellas.gr/politiki-aporritou"
        }
      />
    </div>
  );
};

export const LocatorPage = () => {
  return (
    <LocaleProvider>
      <LocatorPageContent />
    </LocaleProvider>
  );
};

export const LocatorExperience = LocatorPage;
