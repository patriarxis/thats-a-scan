import { LOCALE } from "@/enums";
import { createTranslator } from "@/lib/i18n";

const interpolate = (template: string, vars: Record<string, string>): string =>
  Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template,
  );

export const getSeoDefaults = (locale: LOCALE) => {
  const { t } = createTranslator(locale);
  const keywords = t("seoDefaultKeywords")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    title: t("seoDefaultTitle"),
    description: t("seoDefaultDescription"),
    keywords,
  };
};

export const getHomeSeo = (locale: LOCALE) => {
  const { t } = createTranslator(locale);
  return {
    title: t("seoHomeTitle"),
    description: t("seoHomeDescription"),
  };
};

export const getStoreSeoText = (
  locale: LOCALE,
  storeId: string,
  storeName: string,
  storeAddress: string,
) => {
  const { t } = createTranslator(locale);
  const titleSuffix = t("seoStoreTitleSuffix");
  const titleBase = storeName || `${t("seoStoreFallbackTitlePrefix")} ${storeId}`;
  const title = `${titleBase} | ${titleSuffix}`;

  const description = storeAddress
    ? interpolate(t("seoStoreDescriptionWithAddress"), { address: storeAddress })
    : interpolate(t("seoStoreDescriptionWithoutAddress"), { name: titleBase });

  return {
    title,
    description,
    fallbackTitlePrefix: t("seoStoreFallbackTitlePrefix"),
    fallbackDescription: t("seoStoreFallbackDescription"),
    titleSuffix,
  };
};
