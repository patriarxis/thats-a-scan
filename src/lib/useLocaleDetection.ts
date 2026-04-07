"use client";

import { useState, useEffect } from "react";
import {
  detectLocaleFromPath,
  detectLocaleFromParam,
  getValidLocale,
  DEFAULT_LOCALE
} from "./i18n/config";
import { ILocale } from "../types";

export function useLocaleDetection() {
  const [locale, setLocaleState] = useState<ILocale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  const setLocale = (newLocale: ILocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  useEffect(() => {
    let detectedLocale: string | null = null;

    try {
      // 1. Check URL parameters
      detectedLocale = detectLocaleFromParam(window.location.href);

      // 2. Check URL path
      if (!detectedLocale) {
        detectedLocale = detectLocaleFromPath(window.location.pathname);
      }

      // 3. Check localStorage
      if (!detectedLocale) {
        detectedLocale = localStorage.getItem("locale");
      }

      // 4. Check browser language
      if (!detectedLocale) {
        const browserLang = navigator.languages?.[0] ?? navigator.language;
        if (browserLang) {
          detectedLocale = browserLang.toLowerCase().startsWith("el") ? "el" : "en";
        }
      }

      const finalLocale = getValidLocale(detectedLocale);
      setLocaleState(finalLocale);
    } catch {
      setLocaleState(DEFAULT_LOCALE);
    }

    setIsReady(true);
  }, []);

  return { locale, setLocale, isReady };
}
