import { LOCALE } from "../../enums";
import type { ILocale } from "../../types";

export const AVAILABLE_LOCALES = [LOCALE.EL, LOCALE.EN] as const;
export const DEFAULT_LOCALE = LOCALE.EL as const;

export const locales: ILocale[] = [...AVAILABLE_LOCALES];
export const defaultLocale: ILocale = DEFAULT_LOCALE;

export function isValidLocale(
  locale: string | null | undefined
): locale is ILocale {
  if (!locale) return false;
  return locales.includes(locale.toLowerCase() as ILocale);
}

export function getValidLocale(locale: string | null | undefined): ILocale {
  if (!locale) return defaultLocale;
  const normalized = locale.toLowerCase();
  return isValidLocale(normalized) ? normalized : defaultLocale;
}

export function detectLocaleFromPath(path: string): ILocale | null {
  const match = path.match(/^\/([a-z]{2})(?:\/|$)/i);
  if (match) {
    const locale = match[1].toLowerCase();
    return isValidLocale(locale) ? locale : null;
  }
  return null;
}

export function stripLocalePrefix(path: string): string {
  const locale = detectLocaleFromPath(path);
  if (!locale) return path || "/";
  const withoutPrefix = path.replace(new RegExp(`^/${locale}(?=/|$)`, "i"), "");
  return withoutPrefix || "/";
}

export function applyLocalePrefix(path: string, locale: ILocale): string {
  const normalizedPath = stripLocalePrefix(path || "/");
  if (locale === DEFAULT_LOCALE) {
    return normalizedPath || "/";
  }
  if (normalizedPath === "/") {
    return `/${locale}`;
  }
  return `/${locale}${normalizedPath}`;
}

export function detectLocaleFromParam(url: string): ILocale | null {
  try {
    const urlObj = new URL(url);
    const param =
      urlObj.searchParams.get("locale") || urlObj.searchParams.get("lang");
    if (param) {
      const locale = param.toLowerCase();
      return isValidLocale(locale) ? locale : null;
    }
  } catch {}
  return null;
}

export function getAvailableLocales(): ILocale[] {
  return [...locales];
}
