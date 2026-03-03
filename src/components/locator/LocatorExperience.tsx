"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocaleProvider, useLocale } from "@/components/locale/LocaleProvider";
import { ResultsPanel } from "@/components/locator/ResultsPanel";
import { SearchBar, type SearchSuggestion } from "@/components/locator/SearchBar";
import { StoreDetailSheet } from "@/components/locator/StoreDetailSheet";
import { MapView, type MapViewHandle } from "@/components/map/MapView";
import { fetchMapboxSuggestions } from "@/lib/mapboxGeocoding";
import { searchMerchantSuggestions } from "@/lib/merchantSearchIndex";
import { getMerchantId, type MerchantFeature } from "@/types/merchant";
import {
  MERCHANT_SUGGESTION_LIMIT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SUGGESTION_LIMIT
} from "@/lib/config";

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
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("dark");
    body.classList.add("dark");
  }, []);

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
    <div className="flex min-h-screen flex-col bg-[#191919] text-slate-100">
      <header className="sticky top-0 z-40 bg-[#191919] text-slate-100">
        <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between px-4 md:px-8">
          <a
            href="https://uphellas.gr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3"
          >
            <div className="rounded-xl bg-black/0 p-1.5 ring-1 ring-white/5 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]">
              <Image src="/up-logo.svg" alt="Up Hellas" width={94} height={31} priority />
            </div>
          </a>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setLocale("el")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  locale === "el"
                    ? "bg-white text-slate-900"
                    : "text-white/90 hover:bg-white/15"
                }`}
              >
                EL
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  locale === "en"
                    ? "bg-white text-slate-900"
                    : "text-white/90 hover:bg-white/15"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="h-10 bg-gradient-to-b from-[#191919] to-transparent" />

      <main className="flex-1">
        <section className="relative z-30 overflow-visible bg-[#191919] px-4 pb-10 pt-10 text-white md:px-8">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center text-center">
            <div className="relative z-50 mt-3 w-full">
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

        <section className="relative z-10 mx-auto mt-4 w-full max-w-screen-2xl px-2 pb-8 md:px-8">
          {isMobile ? (
            <div className="space-y-4">
              <div className="relative h-[68vh] overflow-hidden rounded-3xl border border-[#8f499c]/40 bg-[#141018] shadow-[0_22px_65px_rgba(0,0,0,0.75)]">
                <MapView
                  ref={mapRef}
                  className="h-full w-full"
                  selectedMerchantId={selectedId}
                  highlightedMerchantIds={highlightedMerchantIds}
                  zoomInMessage={t("zoomInToSeeStores")}
                  onMerchantSelect={handleSelectMerchant}
                  onVisibleMerchantsChange={handleVisibleMerchantsChange}
                />
                {mapLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-slate-950/55">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow dark:bg-slate-900 dark:text-slate-200">
                      {t("loadingMap")}
                    </div>
                  </div>
                )}
                {mapError && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-2.5 text-sm font-medium text-red-200 shadow-lg backdrop-blur-sm">
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="relative h-[68vh] overflow-hidden rounded-3xl border border-[#8f499c]/40 bg-[#141018] shadow-[0_22px_65px_rgba(0,0,0,0.75)] transition-all duration-300 lg:col-span-8">
                <MapView
                  ref={mapRef}
                  className="h-full w-full"
                  selectedMerchantId={selectedId}
                  highlightedMerchantIds={highlightedMerchantIds}
                  zoomInMessage={t("zoomInToSeeStores")}
                  onMerchantSelect={handleSelectMerchant}
                  onVisibleMerchantsChange={handleVisibleMerchantsChange}
                />

                {mapLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-slate-950/55">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow dark:bg-slate-900 dark:text-slate-200">
                      {t("loadingMap")}
                    </div>
                  </div>
                )}
                {mapError && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-2.5 text-sm font-medium text-red-200 shadow-lg backdrop-blur-sm">
                    {mapError}
                  </div>
                )}

                {selectedMerchant && (
                  <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-sm">
                    <div className="pointer-events-auto">
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

              <div className="transition-all duration-300 lg:col-span-4">
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

      <div className="h-16 bg-gradient-to-b from-transparent to-black/40" />

      <footer className="border-t border-slate-800 bg-[#191919] text-slate-300">
        <div className="mx-auto max-w-screen-2xl px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <a
                href="https://uphellas.gr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <div className="rounded-xl bg-black/0 p-1.5 ring-1 ring-white/5 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]">
                  <Image src="/up-logo.svg" alt="Up Hellas" width={94} height={31} />
                </div>
              </a>
              <p className="mt-3 max-w-xs text-sm text-slate-400">
                Εταιρικές Παροχές & Κάρτες Εργαζομένων. Η Up Hellas είναι μέλος του Up
                Coop Group.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Τα Προϊόντα μας
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://uphellas.gr/proionta/flexone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 transition-colors hover:text-violet-400"
                  >
                    FlexOne
                  </a>
                </li>
                <li>
                  <a
                    href="https://uphellas.gr/proionta/up-gift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 transition-colors hover:text-violet-400"
                  >
                    Up Gift
                  </a>
                </li>
                <li>
                  <a
                    href="https://uphellas.gr/proionta/fitpass"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 transition-colors hover:text-orange-400"
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
