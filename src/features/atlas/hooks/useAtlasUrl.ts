"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTextureId, type TextureFeature } from "@/domain/textures";

export type UrlSelection = {
  textureId: string | null;
  lat: number;
  lng: number;
};

export function parseUrlSelection(href = window.location.href): UrlSelection {
  const url = new URL(href);
  const pathMatch = url.pathname.match(/^\/texture\/([^/]+)$/);
  const textureId = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : null;

  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = latRaw !== null ? Number(latRaw) : NaN;
  const lng = lngRaw !== null ? Number(lngRaw) : NaN;

  return {
    textureId,
    lat: Number.isFinite(lat) ? lat : NaN,
    lng: Number.isFinite(lng) ? lng : NaN,
  };
}

export function useAtlasUrl() {
  const [urlSelection, setUrlSelection] = useState<UrlSelection>(() =>
    typeof window === "undefined"
      ? { textureId: null, lat: NaN, lng: NaN }
      : parseUrlSelection(),
  );

  useEffect(() => {
    const syncFromLocation = () => setUrlSelection(parseUrlSelection());
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const syncUrl = useCallback(
    (opts: { textureId?: string | null; lat?: number; lng?: number }) => {
      if (typeof window === "undefined") return;

      const url = new URL(window.location.href);
      const isTexturePage = /^\/texture\//.test(url.pathname);

      if (opts.textureId) {
        url.pathname = `/texture/${encodeURIComponent(opts.textureId)}`;
      } else if (opts.textureId === null && isTexturePage) {
        url.pathname = "/";
      } else if (!isTexturePage) {
        url.pathname = "/";
      }

      if (opts.lat !== undefined && Number.isFinite(opts.lat)) {
        url.searchParams.set("lat", String(opts.lat));
      } else {
        url.searchParams.delete("lat");
      }

      if (opts.lng !== undefined && Number.isFinite(opts.lng)) {
        url.searchParams.set("lng", String(opts.lng));
      } else {
        url.searchParams.delete("lng");
      }

      window.history.replaceState(null, "", url.toString());
      setUrlSelection(parseUrlSelection(url.toString()));
    },
    [],
  );

  return { urlSelection, syncUrl };
}

/** Opens a texture when the URL points at one (direct link or browser back/forward). */
export function useTextureFromUrl(
  urlSelection: UrlSelection,
  allKnownById: Record<string, TextureFeature>,
  selectedTexture: TextureFeature | null,
  onResolved: (texture: TextureFeature, flyCoords: [number, number]) => void,
  onClear: () => void,
) {
  const allKnownRef = useRef(allKnownById);
  allKnownRef.current = allKnownById;

  useEffect(() => {
    const { textureId, lat, lng } = urlSelection;

    if (!textureId) {
      if (selectedTexture) onClear();
      return;
    }

    if (selectedTexture && getTextureId(selectedTexture) === textureId) {
      return;
    }

    const known = allKnownRef.current[textureId];
    if (known) {
      const [knownLng, knownLat] = known.geometry.coordinates;
      onResolved(known, [
        Number.isFinite(lng) ? lng : knownLng,
        Number.isFinite(lat) ? lat : knownLat,
      ]);
      return;
    }

    let cancelled = false;
    void fetch("/api/textures")
      .then((r) => r.json())
      .then((data: { features?: TextureFeature[] }) => {
        if (cancelled) return;
        const match = data.features?.find(
          (f) => f.properties.id === textureId || f.properties.slug === textureId,
        );
        if (!match) return;
        const [matchLng, matchLat] = match.geometry.coordinates;
        onResolved(match, [
          Number.isFinite(lng) ? lng : matchLng,
          Number.isFinite(lat) ? lat : matchLat,
        ]);
      });

    return () => {
      cancelled = true;
    };
  }, [urlSelection, selectedTexture, onClear, onResolved]);
}
