"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isWithinAthensCatalog } from "@/config/map";

export type UserLocation = {
  lat: number;
  lng: number;
  /** True when coords are inside the Athens catalog bounds */
  inCatalog: boolean;
};

export type UserLocationPermission = "unsupported" | "prompt" | "granted" | "denied";

type UserLocationContextValue = {
  location: UserLocation | null;
  permission: UserLocationPermission;
  onGeolocateSuccess: (coords: { latitude: number; longitude: number }) => void;
  onGeolocateError: (permission: UserLocationPermission) => void;
};

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

const mapGeolocationError = (code: number): UserLocationPermission => {
  if (code === 1) return "denied";
  // TIMEOUT (3) / POSITION_UNAVAILABLE (2) — allow retry
  return "prompt";
};

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permission, setPermission] = useState<UserLocationPermission>("prompt");
  const hasAttemptedInitialRef = useRef(false);

  const applyPermission = useCallback((next: UserLocationPermission) => {
    setPermission(next);
  }, []);

  const onGeolocateSuccess = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      setLocation({
        lat: coords.latitude,
        lng: coords.longitude,
        inCatalog: isWithinAthensCatalog(coords.latitude, coords.longitude),
      });
      applyPermission("granted");
    },
    [applyPermission],
  );

  const onGeolocateError = useCallback(
    (next: UserLocationPermission) => {
      if (next === "denied") {
        setLocation(null);
      }
      applyPermission(next);
    },
    [applyPermission],
  );

  const requestViaNavigator = useCallback(() => {
    if (!("geolocation" in navigator)) {
      applyPermission("unsupported");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      applyPermission("denied");
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      onGeolocateSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    const onError = (error: GeolocationPositionError) => {
      // High-accuracy often times out on desktop — one low-accuracy retry.
      if (error.code === 3 || error.code === 2) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryError) => onGeolocateError(mapGeolocationError(retryError.code)),
          {
            enableHighAccuracy: false,
            timeout: 15_000,
            maximumAge: 60_000,
          },
        );
        return;
      }
      onGeolocateError(mapGeolocationError(error.code));
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 30_000,
    });
  }, [applyPermission, onGeolocateError, onGeolocateSuccess]);

  const syncPermissionFromApi = useCallback(async () => {
    if (!("permissions" in navigator)) return;
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status.state === "granted") {
        applyPermission("granted");
      } else if (status.state === "denied") {
        applyPermission("denied");
      } else {
        applyPermission("prompt");
      }
      status.onchange = () => {
        if (status.state === "granted") {
          applyPermission("granted");
          requestViaNavigator();
        } else if (status.state === "denied") {
          applyPermission("denied");
          setLocation(null);
        } else {
          applyPermission("prompt");
        }
      };
    } catch {
      // Permissions API unavailable.
    }
  }, [applyPermission, requestViaNavigator]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      applyPermission("unsupported");
      return;
    }

    void syncPermissionFromApi();

    if (!hasAttemptedInitialRef.current) {
      hasAttemptedInitialRef.current = true;
      requestViaNavigator();
    }
  }, [applyPermission, requestViaNavigator, syncPermissionFromApi]);

  const value = useMemo(
    () => ({
      location,
      permission,
      onGeolocateSuccess,
      onGeolocateError,
    }),
    [location, permission, onGeolocateSuccess, onGeolocateError],
  );

  return (
    <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>
  );
}

export function useUserLocation(): UserLocationContextValue {
  const context = useContext(UserLocationContext);
  if (!context) {
    throw new Error("useUserLocation must be used within UserLocationProvider");
  }
  return context;
}
