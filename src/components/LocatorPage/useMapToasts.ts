import { useEffect, useMemo, useState } from "react";
import type { ToastStackItem } from "@/components/ui/ToastStack";
import type { UserLocationPermission } from "@/lib/UserLocationContext";

type UseMapToastsParams = {
  mapError: string | null;
  mapLoading: boolean;
  mapUpdating: boolean;
  locationPermission: UserLocationPermission;
  t: (key: string) => string;
};

export function useMapToasts({
  mapError,
  mapLoading,
  mapUpdating,
  locationPermission,
  t,
}: UseMapToastsParams): ToastStackItem[] {
  const [locationToastDismissed, setLocationToastDismissed] = useState(false);

  const showLocationOffToast =
    !locationToastDismissed &&
    locationPermission !== "granted" &&
    locationPermission !== "unsupported";

  useEffect(() => {
    if (locationPermission === "granted") {
      setLocationToastDismissed(false);
    }
  }, [locationPermission]);

  return useMemo(() => {
    const items: ToastStackItem[] = [];

    if (mapError) {
      items.push({ id: "map-error", message: mapError, tone: "error" });
    }
    if (mapLoading) {
      items.push({ id: "map-loading", message: t("loadingMap"), tone: "neutral" });
    }
    if (!mapLoading && mapUpdating && !mapError) {
      items.push({ id: "map-updating", message: t("updatingArea"), tone: "neutral" });
    }
    if (showLocationOffToast) {
      items.push({
        id: "location-off",
        message: t("locationOff"),
        tone: "neutral",
        dismissLabel: t("close"),
        onDismiss: () => setLocationToastDismissed(true),
      });
    }

    return items;
  }, [mapError, mapLoading, mapUpdating, showLocationOffToast, t]);
}
