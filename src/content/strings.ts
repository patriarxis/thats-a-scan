export const strings = {
  searchPlaceholder: "Search textures...",
  searchAria: "Search textures",
  close: "Close",
  copied: "Copied",
  noResults: "No textures found in this area.",
  clearSearch: "Clear search",
  noAddress: "No address available",
  searchResultsOnMap: "{{count}} textures on map",
  searchSectionCategories: "Categories",
  searchSectionTextures: "Textures",
  searchHintNavigate: "Navigate",
  searchHintSelect: "Select",
  searchHintClose: "Close",
  loadingMap: "Loading map...",
  updatingArea: "Updating area...",
  locationOff: "Your location is off",
  openFilters: "Open filters",
  share: "Share",
  description: "Description",
  category: "Category",
  neighborhood: "Neighborhood",
  scannedAt: "Scanned on",
  scannedBy: "Scanned by",
  license: "License",
  dimensions: "Dimensions",
  locationNote: "Location note",
  files: "Files",
  assets: "Assets & downloads",
  format: "Format",
  fileSize: "File size",
  dpi: "DPI",
  download: "Download",
  downloadAll: "Download all",
  licensePersonal: "Personal use",
  licenseCommercial: "Commercial use",
  licenseCcBy: "CC-BY",
  licenseAllRights: "All rights reserved",
  seoDefaultTitle: "Textures Atlas — Athens Texture Library",
  seoDefaultDescription:
    "Explore and download street-captured graphic textures from Athens — graffiti, marble, rust, posters, and more.",
  seoDefaultKeywords:
    "textures, Athens, graffiti, marble, street art, graphic design",
  seoHomeTitle: "Textures Atlas — Athens Texture Map",
  seoHomeDescription:
    "Find and download graphic textures from Athens on an interactive map.",
  seoTextureTitleSuffix: "Textures Atlas",
  seoTextureFallbackTitlePrefix: "Texture",
  seoTextureDescriptionWithAddress: "Download this texture from {{address}}.",
  seoTextureDescriptionWithoutAddress: "Download the texture {{name}} from Athens.",
  seoTextureFallbackDescription: "Texture from the Textures Atlas map.",
  atlasFieldCatalog: "Field catalog · Athens",
  fieldSpecimen: "Archive specimen",
  fieldNotes: "Field notes",
  scannedSample: "Scanned sample",
} as const;

export type StringKey = keyof typeof strings;

export function formatString(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

export function t(key: StringKey): string {
  return strings[key];
}

export const modalLabels = {
  close: strings.close,
  share: strings.share,
  copied: strings.copied,
  download: strings.download,
  downloadAll: strings.downloadAll,
  noAddress: strings.noAddress,
  description: strings.description,
  license: strings.license,
  scannedBy: strings.scannedBy,
  locationNote: strings.locationNote,
  assets: strings.assets,
  dimensions: strings.dimensions,
  format: strings.format,
  fileSize: strings.fileSize,
  dpi: strings.dpi,
  licensePersonal: strings.licensePersonal,
  licenseCommercial: strings.licenseCommercial,
  licenseCcBy: strings.licenseCcBy,
  licenseAllRights: strings.licenseAllRights,
  fieldSpecimen: strings.fieldSpecimen,
  fieldNotes: strings.fieldNotes,
  scannedSample: strings.scannedSample,
  atlasFieldCatalog: strings.atlasFieldCatalog,
} as const;
