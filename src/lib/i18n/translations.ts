import { LOCALE } from "../../enums";
import { ILocale, ITranslations } from "../../types";
import elCommon from "../../locales/el/common.json";
import enCommon from "../../locales/en/common.json";

const translationRegistry: Record<string, ITranslations> = {
  [LOCALE.EL]: {
    common: elCommon
  },
  [LOCALE.EN]: {
    common: enCommon
  }
};

export function getITranslations(locale: ILocale): ITranslations {
  return translationRegistry[locale] || translationRegistry[LOCALE.EL];
}

export function createTranslator(locale: ILocale) {
  const translations = getITranslations(locale);

  const t = (key: string): string => {
    const keys = key.split(".");
    // Default to 'common' namespace if not specified
    let value: any = keys.length > 1 ? translations : translations.common;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }

    return typeof value === "string" ? value : key;
  };

  return {
    t,
    locale,
    common: translations.common
  };
}
