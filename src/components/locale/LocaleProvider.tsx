"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "el" | "en";

const messages = {
  el: {
    searchPlaceholder: "Αναζήτηση διεύθυνσης, περιοχής ή merchant name",
    searchAria: "Αναζήτηση διεύθυνσης, περιοχής ή καταστήματος",
    results: "Αποτελέσματα",
    stores: "καταστήματα",
    openMaps: "Άνοιγμα χάρτη",
    copy: "Αντιγραφή",
    copied: "Αντιγράφηκε",
    favorite: "Αγαπημένο",
    saved: "Αποθηκεύτηκε",
    close: "Κλείσιμο",
    hideList: "Απόκρυψη λίστας",
    showList: "Εμφάνιση λίστας",
    total: "Σύνολο",
    inThisArea: "Σε αυτή την περιοχή",
    map: "Χάρτης",
    list: "Λίστα",
    merchantDetail: "Στοιχεία καταστήματος",
    noResults: "Δεν βρέθηκαν καταστήματα σε αυτή την περιοχή.",
    zoomInToSeeStores: "Κάνε zoom in για να δεις καταστήματα",
    clearSearch: "Καθαρισμός αναζήτησης",
    noAddress: "Δεν υπάρχει διαθέσιμη διεύθυνση",
    loadingSuggestions: "Φόρτωση προτάσεων",
    loadingMap: "Φόρτωση χάρτη...",
    updatingArea: "Ενημέρωση περιοχής...",
    address: "Διεύθυνση"
  },
  en: {
    searchPlaceholder: "Search by address, area, or merchant name",
    searchAria: "Search by address, area, or merchant",
    results: "Results",
    stores: "stores",
    openMaps: "Open maps",
    copy: "Copy",
    copied: "Copied",
    favorite: "Favorite",
    saved: "Saved",
    close: "Close",
    hideList: "Hide list",
    showList: "Show list",
    total: "Total",
    inThisArea: "In this area",
    map: "Map",
    list: "List",
    merchantDetail: "Merchant detail",
    noResults: "No stores found in this area.",
    zoomInToSeeStores: "Zoom in to see stores",
    clearSearch: "Clear search",
    noAddress: "No address available",
    loadingSuggestions: "Loading suggestions",
    loadingMap: "Loading map...",
    updatingArea: "Updating area...",
    address: "Address"
  }
} as const;

type MessageKey = keyof (typeof messages)["el"];

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved === "el" || saved === "en") {
      setLocale(saved);
      return;
    }
    const browser = navigator.languages?.[0] ?? navigator.language ?? "en";
    setLocale(browser.toLowerCase().startsWith("el") ? "el" : "en");
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        setLocale(nextLocale);
        localStorage.setItem("locale", nextLocale);
      },
      t: (key) => messages[locale][key]
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
