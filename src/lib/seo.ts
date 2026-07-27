import { formatString, strings } from "@/content/strings";

export const getSeoDefaults = () => ({
  title: strings.seoDefaultTitle,
  description: strings.seoDefaultDescription,
  keywords: strings.seoDefaultKeywords
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
});

export const getHomeSeo = () => ({
  title: strings.seoHomeTitle,
  description: strings.seoHomeDescription,
});

export const getTextureSeoText = (
  textureId: string,
  textureName: string,
  textureAddress: string,
) => {
  const titleBase =
    textureName || `${strings.seoTextureFallbackTitlePrefix} ${textureId}`;
  const title = `${titleBase} | ${strings.seoTextureTitleSuffix}`;

  const description = textureAddress
    ? formatString(strings.seoTextureDescriptionWithAddress, { address: textureAddress })
    : formatString(strings.seoTextureDescriptionWithoutAddress, { name: titleBase });

  return {
    title,
    description,
    fallbackTitlePrefix: strings.seoTextureFallbackTitlePrefix,
    fallbackDescription: strings.seoTextureFallbackDescription,
    titleSuffix: strings.seoTextureTitleSuffix,
  };
};
