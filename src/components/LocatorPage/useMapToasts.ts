import { useEffect, useMemo, useState } from "react";
import type { ToastStackItem } from "@/components/ui/ToastStack";
import type { UserLocationPermission } from "@/lib/UserLocationContext";

type SearchMapMeta = {
  total: number;
  truncated: boolean;
  displayed: number;
};

type UseMapToastsParams = {
  mapError: string | null;
  mapLoading: boolean;
  mapUpdating: boolean;
  locationPermission: UserLocationPermission;
  searchMapMeta: SearchMapMeta | null;
  searchTruncationDismissed: boolean;
  onDismissSearchTruncation: () => void;
  t: (key: string) => string;
};

export function useMapToasts({
  mapError,
  mapLoading,
  mapUpdating,
  locationPermission,
  searchMapMeta,
  searchTruncationDismissed,
  onDismissSearchTruncation,
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
    if (
      searchMapMeta?.truncated &&
      !searchTruncationDismissed &&
      searchMapMeta.total > searchMapMeta.displayed
    ) {
      items.push({
        id: "search-truncated",
        message: t("searchResultsTruncated")
          .replace("{{displayed}}", String(searchMapMeta.displayed))
          .replace("{{total}}", String(searchMapMeta.total)),
        tone: "neutral",
        dismissLabel: t("close"),
        onDismiss: onDismissSearchTruncation,
      });
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
  }, [
    mapError,
    mapLoading,
    mapUpdating,
    onDismissSearchTruncation,
    searchMapMeta,
    searchTruncationDismissed,
    showLocationOffToast,
    t,
  ]);
}
