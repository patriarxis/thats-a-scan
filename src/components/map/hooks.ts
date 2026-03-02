"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MerchantFeature } from "@/types/merchant";

const STORES_API_URL = "/api/merchants-geojson";
const MAX_LAT_SPAN = 0.35;
const MAX_LNG_SPAN = 0.55;

export type UserLocation = {
  lat: number;
  lng: number;
};

type ViewportQueryState = {
  merchants: MerchantFeature[];
  loading: boolean;
  updating: boolean;
  viewportTooWide: boolean;
};

function haversineDistanceKm(
  pointA: [number, number],
  pointB: [number, number]
): number {
  const [lng1, lat1] = pointA;
  const [lng2, lat2] = pointB;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => {
        setUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  }, []);

  return userLocation;
}

export function useViewportStoreQuery(
  mapRef: MutableRefObject<MapboxMap | null>,
  userLocation: UserLocation | null,
  mapReady: boolean
) {
  const [state, setState] = useState<ViewportQueryState>({
    merchants: [],
    loading: true,
    updating: false,
    viewportTooWide: false
  });
  const hasLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasAppliedLocationFlyRef = useRef(false);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const fetchVisible = async (source: "initial" | "move") => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
      const tooWide = latSpan > MAX_LAT_SPAN || lngSpan > MAX_LNG_SPAN;

      if (tooWide) {
        abortRef.current?.abort();
        setState((prev) => ({
          ...prev,
          loading: false,
          updating: false,
          viewportTooWide: true,
          merchants: []
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: !hasLoadedRef.current,
        updating: hasLoadedRef.current || source === "move",
        viewportTooWide: false
      }));

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(STORES_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            north_west: {
              latitude: bounds.getNorth(),
              longitude: bounds.getWest()
            },
            south_east: {
              latitude: bounds.getSouth(),
              longitude: bounds.getEast()
            }
          }),
          signal: controller.signal
        });
        if (!res.ok) {
          setState((prev) => ({ ...prev, loading: false, updating: false }));
          return;
        }
        const json = (await res.json()) as { features?: MerchantFeature[] };
        const features = Array.isArray(json.features) ? json.features : [];
        const validFeatures = features.filter((feature) => {
          const lng = Number(feature.geometry.coordinates[0]);
          const lat = Number(feature.geometry.coordinates[1]);
          return Number.isFinite(lng) && Number.isFinite(lat);
        });

        const sorted = userLocation
          ? [...validFeatures].sort((a, b) => {
              const dA = haversineDistanceKm(a.geometry.coordinates, [
                userLocation.lng,
                userLocation.lat
              ]);
              const dB = haversineDistanceKm(b.geometry.coordinates, [
                userLocation.lng,
                userLocation.lat
              ]);
              return dA - dB;
            })
          : validFeatures;

        hasLoadedRef.current = true;
        setState({
          merchants: sorted,
          loading: false,
          updating: false,
          viewportTooWide: false
        });
      } catch {
        setState((prev) => ({ ...prev, loading: false, updating: false }));
      }
    };

    const triggerMoveFetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchVisible("move");
      }, 300);
    };

    const onMapReady = () => {
      if (userLocation && !hasAppliedLocationFlyRef.current) {
        hasAppliedLocationFlyRef.current = true;
        map.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 13,
          duration: 900
        });
      } else {
        fetchVisible("initial");
      }
    };

    map.on("moveend", triggerMoveFetch);
    if (map.isStyleLoaded()) onMapReady();
    else map.once("load", onMapReady);

    return () => {
      map.off("moveend", triggerMoveFetch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [mapReady, mapRef, userLocation]);

  return state;
}
