"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { useLocale } from "@/lib";
import { UserLocationProvider, useUserLocation } from "@/lib/UserLocationContext";
import { useIsMobileUx } from "@/lib/useIsMobileUx";
import { LOCALE } from "@/enums";
import {
  type SearchSuggestion
} from "@/components/SearchBar/SearchBar";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import type { FiltersModalProps } from "@/components/FiltersModal/FiltersModal";
import { QuickFilterChips } from "@/components/QuickFilterChips/QuickFilterChips";
import { Backdrop } from "@/components/ui/Backdrop/Backdrop";
import { ToastStack } from "@/components/ui/ToastStack";
import { useMapToasts } from "@/components/LocatorPage/useMapToasts";
import type { MapViewHandle } from "@/components/MapView/MapView";
import { resolveMarkerVisual } from "@/components/MapView/merchantMarkerVisual";
import { LocatorHeader } from "@/components/LocatorHeader/LocatorHeader";
import { LocatorFooter } from "@/components/LocatorFooter/LocatorFooter";
import {
  merchantMatchesSearchQuery,
  searchMerchantSuggestions,
} from "@/lib/merchantSearchIndex";
import {
  applyLocalePrefix,
  detectLocaleFromPath,
  stripLocalePrefix,
} from "@/lib/i18n/config";
import {
  findPopularCategoriesForQuery,
  getPopularSearchCategories,
  merchantMatchesPopularCategory,
  type PopularSearchCategoryId,
} from "@/lib/searchCategories";
import { NETWORK_FILTER_DEFINITIONS } from "@/lib/merchantFilters";
import { useMerchantFilters } from "@/lib/useMerchantFilters";
import { normalizeStr } from "@/lib/stringUtils";
import {
  getMerchantName,
  getPartnerId,
  type PartnerFeature,
  type MerchantDetailSheetLabels,
  type VisiblePartnersChangePayload,
} from "@/types";
import { kickMerchantCatalogueWarmClient } from "@/lib/merchantCatalogueWarmClient";
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
const MerchantDetailSheet = dynamic(
  () =>
    import("@/components/PartnerDetailSheet/PartnerDetailSheet").then(
      (module) => module.MerchantDetailSheet,
    ),
  { ssr: false },
);

type UrlSelectionState = {
  placeId: string | null;
  lat: number;
  lng: number;
};

type UrlSearchState = {
  query: string;
  selectedNetworkIds: string[];
};

type MerchantSearchApiResponse = {
  suggestions?: SearchSuggestion[];
};

const NETWORK_FILTER_ID_SET: ReadonlySet<string> = new Set(
  NETWORK_FILTER_DEFINITIONS.map((item) => item.id),
);

const REMOTE_MERCHANT_SEARCH_MIN_QUERY_LENGTH = 3;

const EMPTY_URL_SELECTION: UrlSelectionState = {
  placeId: null,
  lat: Number.NaN,
  lng: Number.NaN,
};

const parseSelectionFromLocation = (): UrlSelectionState => {
  if (typeof window === "undefined") {
    return { placeId: null, lat: Number.NaN, lng: Number.NaN };
  }
  const url = new URL(window.location.href);
  const localizedPath = stripLocalePrefix(url.pathname);
  const pathMatch = localizedPath.match(/^\/(?:place|store)\/([^/]+)$/);
  const placeIdFromPath = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : null;
  const placeId =
    placeIdFromPath ?? url.searchParams.get("place") ?? url.searchParams.get("store");
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  return { placeId, lat, lng };
};

const parseSearchStateFromLocation = (): UrlSearchState => {
  if (typeof window === "undefined") {
    return { query: "", selectedNetworkIds: [] };
  }
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q") ?? "";
  const selectedNetworkIds = (url.searchParams.get("products") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is string => Boolean(item) && NETWORK_FILTER_ID_SET.has(item));
  return {
    query,
    selectedNetworkIds: Array.from(new Set(selectedNetworkIds)),
  };
};

const LocatorPageContent = () => {
  const mapRef = useRef<MapViewHandle | null>(null);
  const searchRequestRef = useRef(0);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const urlSelectionAppliedRef = useRef<string | null>(null);
  const isSelectingSearchSuggestionRef = useRef(false);
  const isMobile = useIsMobileUx();
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const { locale, setLocale, t } = useLocale();
  const [urlSelection, setUrlSelection] = useState<UrlSelectionState>({
    placeId: null,
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
  /** Committed keyword or category label; keep query when opening merchant details from the map. */
  const [isFreeformKeywordSearch, setIsFreeformKeywordSearch] = useState(false);
  const [closeActiveSignal, setCloseActiveSignal] = useState(0);
  const [activeQuickCategoryId, setActiveQuickCategoryId] = useState<PopularSearchCategoryId | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapUpdating, setMapUpdating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const { permission: locationPermission } = useUserLocation();

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
        icon: category.icon,
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
            icon: category.icon,
          }) satisfies SearchSuggestion,
      ),
    [popularCategories],
  );
  const activeQuickCategory = useMemo(
    () => popularCategories.find((item) => item.id === activeQuickCategoryId) ?? null,
    [activeQuickCategoryId, popularCategories],
  );
  const popularCategoryById = useMemo(
    () => new Map(popularCategories.map((category) => [category.id, category])),
    [popularCategories],
  );
  const {
    selectedNetworkIds,
    setSelectedNetworkIds,
    isFiltersOpen,
    setIsFiltersOpen,
    networkFilterOptions,
    merchantMatchesFilters,
    activeFilterCount,
    toggleNetwork,
    clearAllFilters,
  } = useMerchantFilters(allKnownMerchants);

  const selectedId = selectedPartner ? getPartnerId(selectedPartner) : null;
  const sidebarOpen = !!selectedPartner;
  /** Bottom inset when the desktop detail sheet is open (~40dvh, capped in CSS). */
  const desktopSheetMapPaddingBottomPx = 320;
  const mobileDrawerOffsetPx = 280;
  const mobileSelectedMapBottomExtraPx = 48;
  const closeFiltersToResults = useCallback(() => {
    setIsFiltersOpen(false);
    setSuggestions((prev) =>
      prev.length > 0 ? prev : recommendedCategorySuggestions,
    );
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
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsNarrowViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const showSearchLocaleSwitcher = isMobile || isNarrowViewport;

  useEffect(() => {
    const syncFromBrowserLocation = () => {
      const nextSearchState = parseSearchStateFromLocation();
      setQuery(nextSearchState.query);
      setIsFreeformKeywordSearch(Boolean(nextSearchState.query.trim()));
      setSelectedNetworkIds(nextSearchState.selectedNetworkIds);
      setActiveQuickCategoryId(null);
      setUrlSelection(parseSelectionFromLocation());
    };
    syncFromBrowserLocation();
    window.addEventListener("popstate", syncFromBrowserLocation);
    return () => window.removeEventListener("popstate", syncFromBrowserLocation);
  }, [setSelectedNetworkIds]);

  useEffect(() => {
    if (!selectedPartner || isFreeformKeywordSearch) return;
    setQuery(getMerchantName(selectedPartner, locale));
  }, [locale, selectedPartner, isFreeformKeywordSearch]);

  const syncSelectionInUrl = useCallback(
    (partner: PartnerFeature | null, historyMode: "push" | "replace" = "replace") => {
      const currentUrl = new URL(window.location.href);
      const localeFromPath = detectLocaleFromPath(currentUrl.pathname);
      const activeLocale = localeFromPath ?? locale;
      const nextParams = new URLSearchParams(currentUrl.searchParams.toString());
      const localeAwareRootPath = applyLocalePrefix("/", activeLocale);
      let nextPathname = localeAwareRootPath;
      if (!partner) {
        nextParams.delete("place");
        nextParams.delete("store");
        nextParams.delete("lat");
        nextParams.delete("lng");
      } else {
        const [lng, lat] = partner.geometry.coordinates;
        const partnerId = getPartnerId(partner);
        nextParams.set("lat", String(lat));
        nextParams.set("lng", String(lng));
        nextParams.delete("place");
        nextParams.delete("store");
        nextPathname = applyLocalePrefix(
          `/place/${encodeURIComponent(partnerId)}`,
          activeLocale,
        );
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
    [locale],
  );

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const nextParams = new URLSearchParams(currentUrl.searchParams.toString());
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      nextParams.set("q", trimmedQuery);
    } else {
      nextParams.delete("q");
    }

    if (selectedNetworkIds.length > 0) {
      nextParams.set("products", selectedNetworkIds.join(","));
    } else {
      nextParams.delete("products");
    }

    nextParams.delete("cashback");

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${currentUrl.pathname}?${nextQuery}` : currentUrl.pathname;
    const currentHref = `${currentUrl.pathname}${currentUrl.search}`;
    if (nextUrl !== currentHref) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [query, selectedNetworkIds]);

  const sheetOpenMapPadding = useMemo(
    () =>
      isMobile
        ? {
            top: 52,
            right: 16,
            bottom: mobileDrawerOffsetPx + mobileSelectedMapBottomExtraPx,
            left: 16,
          }
        : {
            top: 64,
            right: 16,
            bottom: desktopSheetMapPaddingBottomPx,
            left: 16,
          },
    [isMobile, mobileDrawerOffsetPx, mobileSelectedMapBottomExtraPx],
  );

  /** Padding for Mapbox `easeTo` / `flyTo` (camera). */
  const focusPadding = useMemo(
    () =>
      sidebarOpen
        ? sheetOpenMapPadding
        : { top: 64, right: 16, bottom: 16, left: 16 },
    [sidebarOpen, sheetOpenMapPadding],
  );

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
      const controller = new AbortController();
      geocodeAbortRef.current = controller;
      setSearchLoading(true);

      if (query.trim().length >= 2) {
        kickMerchantCatalogueWarmClient();
      }

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
            sublabel: result.isDigital ? t("digitalOnly") : (result.sublabel || t("noAddress")),
            merchantId: result.merchantId,
            coordinates: result.coordinates,
            icon: resolveMarkerVisual(
              (allKnownById[result.merchantId] ??
                visiblePartners.find((partner) => getPartnerId(partner) === result.merchantId))
                ?.properties ?? {},
            ).iconKey,
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
            icon: category.icon,
          }) satisfies SearchSuggestion,
      );

      if (requestId === searchRequestRef.current) {
        setSuggestions([...categoryResults, ...merchantResults].slice(0, SEARCH_SUGGESTION_LIMIT));
      }

      let remoteMerchantResults: SearchSuggestion[] = [];
      if (query.trim().length >= REMOTE_MERCHANT_SEARCH_MIN_QUERY_LENGTH) {
        try {
          const params = new URLSearchParams({
            q: query.trim(),
            locale,
            limit: String(SEARCH_SUGGESTION_LIMIT),
          });
          const response = await fetch(`/api/merchant-search?${params.toString()}`, {
            signal: controller.signal,
          });
          if (response.ok) {
            const data = (await response.json()) as MerchantSearchApiResponse;
            remoteMerchantResults = Array.isArray(data.suggestions)
              ? data.suggestions.filter((item) => item.type === "merchant")
              : [];
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Failed to search nationwide merchants:", error);
          }
        }
      }

      if (requestId === searchRequestRef.current && !controller.signal.aborted) {
        const seenMerchantIds = new Set(merchantResults.map((item) => item.merchantId));
        const mergedMerchantResults = [
          ...merchantResults,
          ...remoteMerchantResults.filter((item) => {
            if (!item.merchantId || seenMerchantIds.has(item.merchantId)) return false;
            seenMerchantIds.add(item.merchantId);
            return true;
          }),
        ].slice(0, MERCHANT_SUGGESTION_LIMIT);

        setSuggestions([...categoryResults, ...mergedMerchantResults].slice(0, SEARCH_SUGGESTION_LIMIT));
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      geocodeAbortRef.current?.abort();
    };
  }, [allKnownById, allKnownMerchants, locale, query, recommendedCategorySuggestions, t, visiblePartners]);

  const queryMatchedCategoryIds = useMemo(
    () =>
      query.trim()
        ? findPopularCategoriesForQuery(query, locale, SEARCH_SUGGESTION_LIMIT).map(
            (category) => category.id,
          )
        : [],
    [locale, query],
  );

  const highlightedPartnerIds = useMemo(() => [], []);
  const showQuickChips = !query.trim();

  const merchantMatchesAllFilters = useCallback(
    (merchant: PartnerFeature) => {
      if (!merchantMatchesFilters(merchant)) return false;

      const queryTiedToSelected =
        selectedPartner &&
        !isFreeformKeywordSearch &&
        !activeQuickCategory &&
        normalizeStr(query.trim()) ===
          normalizeStr(getMerchantName(selectedPartner, locale).trim());

      if (queryTiedToSelected) {
        return true;
      }

      if (!activeQuickCategory && query.trim()) {
        if (merchantMatchesSearchQuery(merchant, query, locale)) return true;
        return queryMatchedCategoryIds.some((categoryId) => {
          const category = popularCategoryById.get(categoryId);
          return category ? merchantMatchesPopularCategory(merchant, category, locale) : false;
        });
      }
      if (!activeQuickCategory) return true;
      return merchantMatchesPopularCategory(merchant, activeQuickCategory, locale);
    },
    [
      activeQuickCategory,
      locale,
      merchantMatchesFilters,
      popularCategoryById,
      query,
      queryMatchedCategoryIds,
      selectedPartner,
      isFreeformKeywordSearch,
    ],
  );

  const handleSelectPartner = useCallback(
    (
      partner: PartnerFeature,
      options?: {
        updateUrl?: boolean;
        historyMode?: "push" | "replace";
        /** When picking from autocomplete; always replace query with merchant name even if freeform mode is on. */
        replaceQueryWithMerchantName?: boolean;
      },
    ) => {
      if (options?.updateUrl !== false) {
        syncSelectionInUrl(partner, options?.historyMode ?? "push");
      }
      setSelectedPartner(partner);
      if (options?.replaceQueryWithMerchantName || !isFreeformKeywordSearch) {
        setQuery(getMerchantName(partner, locale));
      }
      mapRef.current?.panTo(partner.geometry.coordinates, sheetOpenMapPadding);
    },
    [isMobile, isFreeformKeywordSearch, locale, mobileDrawerOffsetPx, mobileSelectedMapBottomExtraPx, sheetOpenMapPadding, syncSelectionInUrl],
  );

  const handleCommitFreeformSearch = useCallback(() => {
    setIsFreeformKeywordSearch(query.trim().length > 0);
  }, [query]);

  const clearSelectedPartner = useCallback(
    (
      historyMode: "push" | "replace" = "replace",
      options?: { clearSearchQuery?: boolean },
    ) => {
      urlSelectionAppliedRef.current = null;
      setUrlSelection(EMPTY_URL_SELECTION);
      setSelectedPartner(null);
      syncSelectionInUrl(null, historyMode);
      if (options?.clearSearchQuery !== false) {
        setQuery("");
        setSuggestions([]);
        setActiveQuickCategoryId(null);
        setIsFreeformKeywordSearch(false);
      }
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

  const mapToasts = useMapToasts({
    mapError,
    mapLoading,
    mapUpdating,
    locationPermission,
    t,
  });

  useEffect(() => {
    const { placeId, lat, lng } = urlSelection;
    const hasValidCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

    if (!placeId) {
      urlSelectionAppliedRef.current = null;
      if (selectedPartner) {
        setSelectedPartner(null);
      }
      return;
    }

    const partner = allKnownById[placeId];
    if (partner) {
      if (selectedId !== placeId) {
        handleSelectPartner(partner, { updateUrl: false });
      }
      urlSelectionAppliedRef.current = placeId;
      return;
    }

    if (hasValidCoordinates && urlSelectionAppliedRef.current !== placeId) {
      mapRef.current?.flyTo([lng, lat], 15, focusPadding, { preserveHigherZoom: true });
      urlSelectionAppliedRef.current = placeId;
    }
  }, [
    allKnownById,
    focusPadding,
    handleSelectPartner,
    selectedId,
    selectedPartner,
    urlSelection,
  ]);

  const merchantDetailLabels: MerchantDetailSheetLabels = {
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
    goForEat: t("goForEat"),
    fitpass: t("fitpass"),
    upExpense: t("upExpense"),
    upMeal: t("upMeal"),
    upGift: t("upGift"),
    digitalOnly: t("digitalOnly"),
    photos: t("photos")
  };

  const filtersPanelProps: Omit<FiltersModalProps, "isOpen"> = {
    title: t("filters"),
    closeLabel: t("close"),
    productLabel: t("product"),
    clearAllFiltersLabel: t("clearAllFilters"),
    noAvailableProductsLabel: t("noAvailableProducts"),
    selectedNetworkIds,
    networkOptions: networkFilterOptions,
    onClose: closeFiltersToResults,
    onToggleNetwork: toggleNetwork,
    onClearAll: clearAllFilters,
  };

  return (
    <div
      className={styles.root}
      data-sidebar-open={sidebarOpen ? "true" : "false"}
    >
      <MapView
        ref={mapRef}
        locale={locale}
        selectedPartnerId={selectedId}
        highlightedPartnerIds={highlightedPartnerIds}
        partnerFilter={merchantMatchesAllFilters}
        onPartnerSelect={handleSelectPartner}
        onVisiblePartnersChange={handleVisiblePartnersChange}
        onMapClick={requestCloseSelectedPartner}
      />
      <ToastStack items={mapToasts} className={styles.mapToastStack} />

      {!isMobile && <LocatorHeader locale={locale} onChangeLocale={setLocale} />}

      <div className={styles.searchOverlay}>
        <div
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
            showLocaleSwitcher={showSearchLocaleSwitcher}
            localeSwitcherAriaLabel={t("language")}
            onOpenLocalePanel={handleOpenLanguageModal}
            filterActiveCount={activeFilterCount}
            categorySectionLabel={t("searchSectionCategories")}
            placeSectionLabel={t("searchSectionPlaces")}
            keyboardHintNavigate={t("searchHintNavigate")}
            keyboardHintSelect={t("searchHintSelect")}
            keyboardHintClose={t("searchHintClose")}
            closeActiveSignal={closeActiveSignal}
            onCloseSearch={closeFiltersToDefault}
            isFiltersOpen={isFiltersOpen}
            filtersPanelProps={filtersPanelProps}
            onCommitFreeformSearch={handleCommitFreeformSearch}
            onChange={(nextQuery) => {
              if (isSelectingSearchSuggestionRef.current) {
                return;
              }
              if (isFiltersOpen) {
                setIsFiltersOpen(false);
              }
              if (!isFreeformKeywordSearch && selectedPartner) {
                const tied = normalizeStr(
                  getMerchantName(selectedPartner, locale).trim(),
                );
                const nextNorm = normalizeStr(nextQuery.trim());
                if (tied !== nextNorm) {
                  clearSelectedPartner("replace", { clearSearchQuery: false });
                }
              }
              if (activeQuickCategoryId) {
                const category = popularCategoryById.get(activeQuickCategoryId);
                const nextNorm = normalizeStr(nextQuery.trim());
                const categoryNorm = normalizeStr(category?.label.trim() ?? "");
                if (!nextNorm || nextNorm !== categoryNorm) {
                  setActiveQuickCategoryId(null);
                }
              }
              if (!nextQuery.trim()) {
                setIsFreeformKeywordSearch(false);
                setActiveQuickCategoryId(null);
              }
              setQuery(nextQuery);
            }}
            onClear={() => {
              clearSelectedPartner("replace");
            }}
            onSelect={(item) => {
              isSelectingSearchSuggestionRef.current = true;
              try {
                if (item.type === "category" && item.categoryId) {
                  clearSelectedPartner("replace", { clearSearchQuery: false });
                  setActiveQuickCategoryId(item.categoryId as PopularSearchCategoryId);
                  setQuery(item.label);
                  setIsFreeformKeywordSearch(true);
                  setSuggestions([]);
                  return;
                }
                if (!item.merchantId || !item.coordinates) return;
                setIsFreeformKeywordSearch(false);
                const partner = allKnownById[item.merchantId];
                if (partner) {
                  handleSelectPartner(partner, { replaceQueryWithMerchantName: true });
                } else {
                  mapRef.current?.panTo(item.coordinates, focusPadding);
                  setQuery(item.label);
                }
                setSuggestions([]);
              } finally {
                queueMicrotask(() => {
                  isSelectingSearchSuggestionRef.current = false;
                });
              }
            }}
            onOpenFilters={() => setIsFiltersOpen(true)}
            onFocusInput={() => {
              kickMerchantCatalogueWarmClient();
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
                clearSelectedPartner("replace", { clearSearchQuery: false });
                const nextId = id as PopularSearchCategoryId;
                const isDeselecting = activeQuickCategoryId === nextId;
                if (isDeselecting) {
                  setActiveQuickCategoryId(null);
                  setQuery("");
                  setIsFreeformKeywordSearch(false);
                  return;
                }
                const selectedCategory = popularCategories.find((item) => item.id === id);
                setActiveQuickCategoryId(nextId);
                if (selectedCategory) {
                  setQuery(selectedCategory.label);
                  setIsFreeformKeywordSearch(true);
                }
              }}
            />
          </div>
        )}
      </div>
      {showSearchLocaleSwitcher && (
        <Backdrop
          isOpen={isLanguageModalOpen}
          onClick={() => setIsLanguageModalOpen(false)}
          className={styles.languageModalOverlay}
          tone="strong"
          exitDurationMs={100}
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
          <MerchantDetailSheet
            partner={selectedPartner}
            isMobile={isMobile}
            locale={locale}
            labels={merchantDetailLabels}
            onClose={() =>
              clearSelectedPartner("replace", {
                clearSearchQuery: !isFreeformKeywordSearch,
              })
            }
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
      <UserLocationProvider>
        <LocatorPageContent />
      </UserLocationProvider>
    </LocaleProvider>
  );
};
