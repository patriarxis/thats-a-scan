"use client";

import { useState, useEffect } from "react";
import {
  detectLocaleFromPath,
  detectLocaleFromParam,
  applyLocalePrefix,
  getValidLocale,
  DEFAULT_LOCALE
} from "./i18n/config";
import { ILocale } from "../types";

export function useLocaleDetection() {
  const [locale, setLocaleState] = useState<ILocale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  const setLocale = (newLocale: ILocale) => {
    const nextLocale = getValidLocale(newLocale);
    setLocaleState(nextLocale);
    localStorage.setItem("locale", nextLocale);
    document.cookie = `locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;

    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      const nextPathname = applyLocalePrefix(currentUrl.pathname, nextLocale);
      const nextUrl = `${nextPathname}${currentUrl.search}${currentUrl.hash}`;
      const currentPathWithQueryAndHash = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      if (nextUrl !== currentPathWithQueryAndHash) {
        window.history.replaceState(null, "", nextUrl);
      }
    }
  };

  useEffect(() => {
    try {
      const localeFromPath = detectLocaleFromPath(window.location.pathname);
      const localeFromParam = detectLocaleFromParam(window.location.href);
      const finalLocale = getValidLocale(localeFromPath ?? localeFromParam ?? DEFAULT_LOCALE);
      setLocaleState(finalLocale);
      localStorage.setItem("locale", finalLocale);
      document.cookie = `locale=${finalLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      setLocaleState(DEFAULT_LOCALE);
    }

    setIsReady(true);
  }, []);

  return { locale, setLocale, isReady };
}
