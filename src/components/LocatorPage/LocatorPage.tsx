"use client";

import dynamic from "next/dynamic";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { useLocale } from "@/lib";
import {
  type SearchSuggestion
} from "@/components/SearchBar/SearchBar";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { QuickFilterChips } from "@/components/QuickFilterChips/QuickFilterChips";
import type { MapViewHandle } from "@/components/MapView/MapView";
import { LocatorHeader } from "@/components/LocatorHeader/LocatorHeader";
import { LocatorFooter } from "@/components/LocatorFooter/LocatorFooter";
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

const MapView = dynamic(
  () => import("@/components/MapView/MapView").then((module) => module.MapView),
  { ssr: false },
);
const FiltersModal = dynamic(
  () =>
    import("@/components/FiltersModal/FiltersModal").then(
      (module) => module.FiltersModal,
    ),
  { ssr: false },
);
const PartnerDetailSheet = dynamic(
  () =>
    import("@/components/PartnerDetailSheet/PartnerDetailSheet").then(
      (module) => module.PartnerDetailSheet,
    ),
  { ssr: false },
);

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
  const mapRef = useRef<MapViewHandle | null>(null);
  const searchRequestRef = useRef(0);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const urlSelectionAppliedRef = useRef<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const isMobile = useMediaQuery("(max-width: 768px)");
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

  useEffect(() => {
    const syncFromBrowserLocation = () => {
      setUrlSelection(parseSelectionFromLocation());
    };
    syncFromBrowserLocation();
    window.addEventListener("popstate", syncFromBrowserLocation);
    return () => window.removeEventListener("popstate", syncFromBrowserLocation);
  }, []);

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
      setSuggestions([]);
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

      if (requestId === searchRequestRef.current) {
        setSuggestions(merchantResults);
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      geocodeAbortRef.current?.abort();
    };
  }, [allKnownMerchants, locale, query, t, visiblePartners]);

  const highlightedPartnerIds = useMemo(
    () =>
      suggestions
        .filter((item) => item.type === "merchant")
        .map((item) => item.merchantId),
    [suggestions],
  );

  const handleSelectPartner = useCallback(
    (
      partner: PartnerFeature,
      options?: { updateUrl?: boolean; historyMode?: "push" | "replace" },
    ) => {
      setSelectedPartner(partner);
      mapRef.current?.flyTo(partner.geometry.coordinates, 15.5, {
        top: 64,
        right: 16,
        bottom: isMobile ? mobileDrawerOffsetPx : desktopDrawerOffsetPx,
        left: 16,
      }, { preserveHigherZoom: true });
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
              const partner = allKnownById[item.merchantId];
              if (partner) {
                handleSelectPartner(partner);
              } else {
                mapRef.current?.flyTo(item.coordinates, 15, focusPadding, {
                  preserveHigherZoom: true,
                });
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
            onClose={() => clearSelectedPartner()}
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
