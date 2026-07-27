"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type { MapViewHandle } from "@/components/MapView/MapView";
import { AtlasHeader } from "@/features/atlas/AtlasHeader";
import { useAtlasUrl, useTextureFromUrl } from "@/features/atlas/hooks/useAtlasUrl";
import {
  getTextureId,
  type TextureFeature,
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

  const handleVisibleTexturesChange = useCallback((payload: VisibleTexturesPayload) => {
    setAllKnownById((prev) => {
      const next = { ...prev };
      for (const texture of payload.textures) {
        next[getTextureId(texture)] = texture;
      }
      return next;
    });
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
        onVisibleTexturesChange={handleVisibleTexturesChange}
        onTextureSelect={openTexture}
        onMapClick={closeTexture}
      />

      <AtlasHeader />

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
