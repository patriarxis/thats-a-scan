"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { LocaleProvider, useLocale, LOCALE } from "@/lib";
import { ResultsPanel } from "@/components/ResultsPanel";
import { SearchBar, type SearchSuggestion } from "@/components/SearchBar";
import { StoreDetailSheet } from "@/components/StoreDetailSheet";
import { MapView, type MapViewHandle } from "@/components/MapView";
import { fetchMapboxSuggestions } from "@/lib/mapboxGeocoding";
import { searchMerchantSuggestions } from "@/lib/merchantSearchIndex";
import { getMerchantId, type MerchantFeature } from "@/types";
import {
  MERCHANT_SUGGESTION_LIMIT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SUGGESTION_LIMIT
} from "@/lib/config";
import styles from "./LocatorExperience.module.scss";

function useMediaQuery(query: string) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return isMobile;
}

function LocatorExperienceContent() {
  const mapRef = useRef<MapViewHandle | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { locale, setLocale, t } = useLocale();

  const [visibleMerchants, setVisibleMerchants] = useState<MerchantFeature[]>([]);
  const [allKnownById, setAllKnownById] = useState<Record<string, MerchantFeature>>({});
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantFeature | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const allKnownMerchants = useMemo(
    () => Object.values(allKnownById),
    [allKnownById]
  );

  const selectedId = selectedMerchant ? getMerchantId(selectedMerchant) : null;

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

      const timer = setTimeout(async () => {
      setSearchLoading(true);
      const merchantResults = searchMerchantSuggestions(
        query,
        allKnownMerchants,
        locale,
        MERCHANT_SUGGESTION_LIMIT
      ).map(
        (result) =>
          ({
            type: "merchant",
            id: result.id,
            label: result.label,
            sublabel: result.sublabel || t("noAddress"),
            merchantId: result.merchantId,
            coordinates: result.coordinates
          }) satisfies SearchSuggestion
      );

      const placeResults = (await fetchMapboxSuggestions(query, token)).map(
        (result) =>
          ({
            type: "place",
            id: `place:${result.id}`,
            label: result.label,
            sublabel: result.sublabel,
            center: result.center
          }) satisfies SearchSuggestion
      );

      setSuggestions([...merchantResults, ...placeResults].slice(0, SEARCH_SUGGESTION_LIMIT));
      setSearchLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [allKnownMerchants, locale, query, t, token]);

  const highlightedMerchantIds = useMemo(
    () =>
      suggestions
        .filter((item) => item.type === "merchant")
        .map((item) => item.merchantId),
    [suggestions]
  );

  const handleSelectMerchant = useCallback((merchant: MerchantFeature) => {
    setSelectedMerchant(merchant);
    mapRef.current?.flyTo(merchant.geometry.coordinates, 15.5);
  }, []);

  const handleVisibleMerchantsChange = useCallback(
    ({
      merchants,
      loading,
      error
    }: {
      merchants: MerchantFeature[];
      loading: boolean;
      updating: boolean;
      error: string | null;
    }) => {
      setVisibleMerchants(merchants);
      setMapLoading(loading);
      setMapError(error);
      setAllKnownById((prev) => {
        const next = { ...prev };
        for (const merchant of merchants) {
          next[getMerchantId(merchant)] = merchant;
        }
        return next;
      });
    },
    []
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a
            href="https://uphellas.gr"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logoLink}
          >
            <div className={styles.logoBox}>
              <Image src="/up-logo.svg" alt="Up Hellas" width={94} height={31} priority />
            </div>
          </a>
          <div className={styles.localeControls}>
            <div className={styles.localeToggle}>
              <button
                type="button"
                onClick={() => setLocale(LOCALE.EL)}
                className={`${styles.localeBtn} ${locale === LOCALE.EL ? styles.localeBtnActive : ""}`}
              >
                EL
              </button>
              <button
                type="button"
                onClick={() => setLocale(LOCALE.EN)}
                className={`${styles.localeBtn} ${locale === LOCALE.EN ? styles.localeBtnActive : ""}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.topGradient} />

      <main className={styles.mainContent}>
        <section className={styles.searchSection}>
          <div className={styles.searchContainer}>
            <div className={styles.searchBarWrapper}>
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
                    mapRef.current?.flyTo(item.center, 13.5);
                    setSelectedMerchant(null);
                  } else {
                    const merchant = allKnownById[item.merchantId];
                    if (merchant) {
                      handleSelectMerchant(merchant);
                    } else {
                      mapRef.current?.flyTo(item.coordinates, 15);
                    }
                  }
                  setQuery(item.label);
                  setSuggestions([]);
                }}
              />
            </div>
          </div>
        </section>

        <section className={styles.mapResultsSection}>
          {isMobile ? (
            <div className={styles.mobileLayout}>
              <div className={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  selectedMerchantId={selectedId}
                  highlightedMerchantIds={highlightedMerchantIds}
                  zoomInMessage={t("zoomInToSeeStores")}
                  onMerchantSelect={handleSelectMerchant}
                  onVisibleMerchantsChange={handleVisibleMerchantsChange}
                />
                {mapLoading && (
                  <div className={styles.mapLoadingOverlay}>
                    <div className={styles.mapLoadingLabel}>
                      {t("loadingMap")}
                    </div>
                  </div>
                )}
                {mapError && (
                  <div className={styles.mapErrorOverlay}>
                    {mapError}
                  </div>
                )}
              </div>

              <ResultsPanel
                merchants={visibleMerchants}
                selectedId={selectedId}
                loading={mapLoading}
                height={620}
                title={t("results")}
                storesLabel={t("stores")}
                noResultsLabel={t("noResults")}
                noAddressLabel={t("noAddress")}
                locale={locale}
                onSelect={handleSelectMerchant}
              />

              {selectedMerchant && (
                <StoreDetailSheet
                  merchant={selectedMerchant}
                  isMobile
                  locale={locale}
                  labels={{
                    merchantDetail: t("merchantDetail"),
                    close: t("close"),
                    address: t("address"),
                    noAddress: t("noAddress"),
                    openMaps: t("openMaps"),
                    copy: t("copy"),
                    copied: t("copied"),
                    favorite: t("favorite"),
                    saved: t("saved")
                  }}
                  onClose={() => setSelectedMerchant(null)}
                />
              )}
            </div>
          ) : (
            <div className={styles.desktopGrid}>
              <div className={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  selectedMerchantId={selectedId}
                  highlightedMerchantIds={highlightedMerchantIds}
                  zoomInMessage={t("zoomInToSeeStores")}
                  onMerchantSelect={handleSelectMerchant}
                  onVisibleMerchantsChange={handleVisibleMerchantsChange}
                />

                {mapLoading && (
                  <div className={styles.mapLoadingOverlay}>
                    <div className={styles.mapLoadingLabel}>
                      {t("loadingMap")}
                    </div>
                  </div>
                )}
                {mapError && (
                  <div className={styles.mapErrorOverlay}>
                    {mapError}
                  </div>
                )}

                {selectedMerchant && (
                  <div className={styles.desktopDetailWrapper}>
                    <div className={styles.desktopDetailInner}>
                      <StoreDetailSheet
                        merchant={selectedMerchant}
                        locale={locale}
                        labels={{
                          merchantDetail: t("merchantDetail"),
                          close: t("close"),
                          address: t("address"),
                          noAddress: t("noAddress"),
                          openMaps: t("openMaps"),
                          copy: t("copy"),
                          copied: t("copied"),
                          favorite: t("favorite"),
                          saved: t("saved")
                        }}
                        onClose={() => setSelectedMerchant(null)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.resultsSidebar}>
                <ResultsPanel
                  merchants={visibleMerchants}
                  selectedId={selectedId}
                  loading={mapLoading}
                  height={530}
                  title={t("results")}
                  storesLabel={t("stores")}
                  noResultsLabel={t("noResults")}
                  noAddressLabel={t("noAddress")}
                  locale={locale}
                  onSelect={handleSelectMerchant}
                />
              </div>
            </div>
          )}
        </section>
      </main>

      <div className={styles.bottomGradient} />

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <a
                href="https://uphellas.gr"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerBrandLink}
              >
                <div className={styles.logoBox}>
                  <Image src="/up-logo.svg" alt="Up Hellas" width={94} height={31} />
                </div>
              </a>
              <p className={styles.footerDescription}>
                Εταιρικές Παροχές & Κάρτες Εργαζομένων. Η Up Hellas είναι μέλος του Up
                Coop Group.
              </p>
            </div>

            <div>
              <h4 className={styles.footerColumnTitle}>
                Τα Προϊόντα μας
              </h4>
              <ul className={styles.footerList}>
                <li>
                  <a
                    href="https://uphellas.gr/proionta/flexone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                  >
                    FlexOne
                  </a>
                </li>
                <li>
                  <a
                    href="https://uphellas.gr/proionta/up-gift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                  >
                    Up Gift
                  </a>
                </li>
                <li>
                  <a
                    href="https://uphellas.gr/proionta/fitpass"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLinkOrange}
                  >
                    Fitpass
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LocatorExperience() {
  return (
    <LocaleProvider>
      <LocatorExperienceContent />
    </LocaleProvider>
  );
}
