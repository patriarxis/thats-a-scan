"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { LocaleProvider, useLocale } from "@/lib";
import {
  SearchBar,
  type SearchSuggestion,
  QuickFilterChips,
  FiltersModal,
  PartnerDetailSheet,
  MapView,
  type MapViewHandle,
  LocatorHeader,
  LocatorFooter,
} from "@/components";
import { fetchMapboxSuggestions } from "@/lib/mapboxGeocoding";
import { searchMerchantSuggestions } from "@/lib/merchantSearchIndex";
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

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
};

const LocatorPageContent = () => {
  const mapRef = useRef<MapViewHandle | null>(null);
  const searchRequestRef = useRef(0);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { locale, setLocale, t } = useLocale();

  const [visiblePartners, setVisiblePartners] = useState<PartnerFeature[]>(
    [],
  );
  const [allKnownById, setAllKnownById] = useState<Record<string, PartnerFeature>
  >({});
  const [selectedPartner, setSelectedPartner] = useState<PartnerFeature | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapUpdating, setMapUpdating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const allKnownMerchants = useMemo(
    () => Object.values(allKnownById),
    [allKnownById],
  );
  const {
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
  } = useMerchantFilters(allKnownMerchants);

  const selectedId = selectedPartner ? getPartnerId(selectedPartner) : null;
  const sidebarOpen = !!selectedPartner;
  const desktopDrawerOffsetPx = 340;
  const mobileDrawerOffsetPx = 280;

  const focusPadding = useMemo(() => {
    if (!sidebarOpen) {
      return { top: 72, right: 24, bottom: 24, left: 24 };
    }
    return {
      top: 72,
      right: 24,
      bottom: isMobile ? mobileDrawerOffsetPx : desktopDrawerOffsetPx,
      left: 24,
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!query.trim()) {
      geocodeAbortRef.current?.abort();
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++searchRequestRef.current;
      geocodeAbortRef.current?.abort();
      const geocodeController = new AbortController();
      geocodeAbortRef.current = geocodeController;
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

      const placeResults = (await fetchMapboxSuggestions(query, token, geocodeController.signal)).map(
        (result) =>
          ({
            type: "place",
            id: `place:${result.id}`,
            label: result.label,
            sublabel: result.sublabel,
            center: result.center,
          }) satisfies SearchSuggestion,
      );

      if (requestId === searchRequestRef.current) {
        setSuggestions(
          [...merchantResults, ...placeResults].slice(0, SEARCH_SUGGESTION_LIMIT),
        );
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      geocodeAbortRef.current?.abort();
    };
  }, [allKnownMerchants, locale, query, t, token, visiblePartners]);

  const highlightedPartnerIds = useMemo(
    () =>
      suggestions
        .filter((item) => item.type === "merchant")
        .map((item) => item.merchantId),
    [suggestions],
  );

  const handleSelectPartner = useCallback(
    (partner: PartnerFeature) => {
      setSelectedPartner(partner);
      mapRef.current?.flyTo(partner.geometry.coordinates, 15.5, {
        top: 72,
        right: 24,
        bottom: isMobile ? mobileDrawerOffsetPx : desktopDrawerOffsetPx,
        left: 24,
      }, { preserveHigherZoom: true });
    },
    [isMobile],
  );

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
    categoryMeal: t("categoryMeal")
  };

  const filterLabels: Record<CategoryId, string> = {
    meal: t("categoryMeal"),
    rewards: t("categoryRewards"),
    expenses: t("categoryExpenses"),
    gyms: t("categoryGyms"),
  };

  return (
    <div
      className={styles.root}
      data-sidebar-open={sidebarOpen ? "true" : "false"}
    >
      <div className={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          selectedPartnerId={selectedId}
          highlightedPartnerIds={highlightedPartnerIds}
          zoomInMessage={t("zoomInToSeeStores")}
          partnerFilter={merchantMatchesFilters}
          onPartnerSelect={handleSelectPartner}
          onVisiblePartnersChange={handleVisiblePartnersChange}
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
      </div>

      <LocatorHeader locale={locale} onChangeLocale={setLocale} />

      <div className={styles.searchOverlay}>
        <div className={styles.searchContainer}>
          <SearchBar
            value={query}
            loading={searchLoading}
            suggestions={suggestions}
            placeholder={t("searchPlaceholder")}
            searchAriaLabel={t("searchAria")}
            clearAriaLabel={t("clearSearch")}
            loadingAriaLabel={t("loadingSuggestions")}
            onChange={setQuery}
            onClear={() => {
              setQuery("");
              setSuggestions([]);
            }}
            onSelect={(item) => {
              if (item.type === "place") {
                setSelectedPartner(null);
                mapRef.current?.flyTo(item.center, 13.5, {
                  top: 72,
                  right: 24,
                  bottom: 24,
                  left: 24,
                });
              } else {
                const partner = allKnownById[item.merchantId];
                if (partner) {
                  handleSelectPartner(partner);
                } else {
                  mapRef.current?.flyTo(
                    item.coordinates,
                    15,
                    focusPadding,
                    { preserveHigherZoom: true },
                  );
                }
              }
              setQuery(item.label);
              setSuggestions([]);
            }}
          />
        </div>

        <div className={styles.filtersContainer}>
          <QuickFilterChips
            selectedIds={selectedNetworkIds}
            onToggle={toggleNetwork}
            labels={filterLabels}
          />
          <button
            type="button"
            className={styles.filtersButton}
            onClick={() => setIsFiltersOpen(true)}
            aria-label={t("openFilters")}
          >
            <SlidersHorizontal size={16} />
            <span>{t("filters")}</span>
            {activeFilterCount > 0 && (
              <span className={styles.filtersBadge}>{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>
      <FiltersModal
        isOpen={isFiltersOpen}
        title={t("filters")}
        closeLabel={t("close")}
        networkCategoryLabel={t("networkCategory")}
        productLabel={t("product")}
        cashbackLabel={t("cashback")}
        cashbackOnlyLabel={t("cashbackOnly")}
        clearAllFiltersLabel={t("clearAllFilters")}
        applyFiltersLabel={t("applyFilters")}
        noAvailableProductsLabel={t("noAvailableProducts")}
        networkLabels={filterLabels}
        selectedNetworkIds={selectedNetworkIds}
        selectedProductIds={selectedProductIds}
        productOptions={productFilterOptions}
        cashbackOnly={cashbackOnly}
        onClose={() => setIsFiltersOpen(false)}
        onToggleNetwork={toggleNetwork}
        onToggleProduct={toggleProduct}
        onToggleCashback={() => setCashbackOnly((prev) => !prev)}
        onClearAll={clearAllFilters}
      />

      <div className={styles.bottomDrawer} aria-hidden={!sidebarOpen}>
        {selectedPartner && (
          <PartnerDetailSheet
            partner={selectedPartner}
            isMobile
            locale={locale}
            labels={partnerDetailLabels}
            onClose={() => setSelectedPartner(null)}
          />
        )}
      </div>

      <LocatorFooter termsLabel="Όροι Χρήσης" privacyLabel="Πολιτική Απορρήτου" />
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
