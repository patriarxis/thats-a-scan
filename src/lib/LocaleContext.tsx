"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { createTranslator } from "./i18n";
import { useLocaleDetection } from "./useLocaleDetection";
import { ILocale, ITranslations } from "../types";

interface LocaleContextType {
  locale: ILocale;
  setLocale: (locale: ILocale) => void;
  t: (key: string) => string;
  common: ITranslations["common"];
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { locale, setLocale, isReady } = useLocaleDetection();
  
  const translator = useMemo(
    () => createTranslator(locale),
    [locale]
  );

  useEffect(() => {
    if (isReady && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale, isReady]);

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        t: translator.t,
        common: translator.common,
        isReady,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
};
