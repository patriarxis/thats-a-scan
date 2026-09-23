"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import type { MapViewHandle } from "@/components/MapView/MapView";
import { AtlasHeader } from "@/features/atlas/AtlasHeader";
import { useAtlasUrl, useTextureFromUrl } from "@/features/atlas/hooks/useAtlasUrl";
import {
  collectFilterOptions,
  EMPTY_TEXTURE_FILTERS,
  getTextureId,
  type TextureCategory,
  type TextureFeature,
  type TextureFilterState,
  type VisibleTexturesPayload,
} from "@/domain/textures";
import { UserLocationProvider } from "@/shared/hooks/useUserLocation";
import styles from "./AtlasPage.module.scss";

const MapView = dynamic(
  () => import("@/components/MapView/MapView").then((m) => m.MapView),
  { ssr: false },
);

const TextureAssetModal = dynamic(
  () =>
    import("@/features/texture/TextureAssetModal").then((m) => m.TextureAssetModal),
  { ssr: false },
);

function AtlasPageContent() {
  const mapRef = useRef<MapViewHandle | null>(null);
  const { urlSelection, syncUrl } = useAtlasUrl();

  const [allKnownById, setAllKnownById] = useState<Record<string, TextureFeature>>({});
  const [selectedTexture, setSelectedTexture] = useState<TextureFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TextureFilterState>(EMPTY_TEXTURE_FILTERS);
  const [searchPinnedIds, setSearchPinnedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const handleVisibleTexturesChange = useCallback((payload: VisibleTexturesPayload) => {
    setAllKnownById((prev) => {
      const next = { ...prev };
      for (const texture of payload.textures) {
        next[getTextureId(texture)] = texture;
      }
      return next;
    });
  }, []);

  // Option lists come from what has actually loaded, never a hardcoded table.
  const filterOptions = useMemo(
    () => collectFilterOptions(Object.values(allKnownById)),
    [allKnownById],
  );

  const handleSearchResultsChange = useCallback((results: TextureFeature[]) => {
    setSearchPinnedIds(new Set(results.map(getTextureId)));
    setAllKnownById((prev) => {
      const next = { ...prev };
      for (const texture of results) next[getTextureId(texture)] = texture;
      return next;
    });
  }, []);

  const handleSelectCategory = useCallback((category: TextureCategory) => {
    setFilters((prev) =>
      prev.categories.includes(category)
        ? prev
        : { ...prev, categories: [...prev.categories, category] },
    );
  }, []);

  const openTexture = useCallback(
    (texture: TextureFeature) => {
      setSelectedTexture(texture);
      setAllKnownById((prev) => ({ ...prev, [getTextureId(texture)]: texture }));
      const [lng, lat] = texture.geometry.coordinates;
      syncUrl({ textureId: getTextureId(texture), lat, lng });
      mapRef.current?.flyTo([lng, lat], 16, undefined, { preserveHigherZoom: true });
    },
    [syncUrl],
  );

  const closeTexture = useCallback(() => {
    setSelectedTexture(null);
    syncUrl({ textureId: null, lat: NaN, lng: NaN });
  }, [syncUrl]);

  useTextureFromUrl(
    urlSelection,
    allKnownById,
    selectedTexture,
    useCallback(
      (texture, flyCoords) => {
        setAllKnownById((prev) => ({ ...prev, [getTextureId(texture)]: texture }));
        setSelectedTexture(texture);
        mapRef.current?.flyTo(flyCoords, 16, undefined, { preserveHigherZoom: true });
      },
      [],
    ),
    useCallback(() => setSelectedTexture(null), []),
  );

  return (
    <div className={styles.root}>
      <MapView
        ref={mapRef}
        className={styles.map}
        selectedTextureId={selectedTexture ? getTextureId(selectedTexture) : null}
        filters={filters}
        searchQuery={searchQuery}
        searchPinnedIds={searchPinnedIds}
        onVisibleTexturesChange={handleVisibleTexturesChange}
        onTextureSelect={openTexture}
        onMapClick={closeTexture}
      />

      <AtlasHeader
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchResultsChange={handleSearchResultsChange}
        onSelectTexture={openTexture}
        onSelectCategory={handleSelectCategory}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={setFilters}
      />

      <TextureAssetModal texture={selectedTexture} onClose={closeTexture} />
    </div>
  );
}

export function AtlasPage() {
  return (
    <UserLocationProvider>
      <AtlasPageContent />
    </UserLocationProvider>
  );
}
