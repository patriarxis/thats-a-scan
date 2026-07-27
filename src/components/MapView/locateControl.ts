import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import { isWithinAthensCatalog } from "@/config/map";
import {
  ATHENS_CENTER,
  ATHENS_INITIAL_ZOOM,
  INITIAL_FOCUS_ZOOM,
} from "./mapViewConstants";

export type LocateStatusTone = "neutral" | "error";

type LocateHandlers = {
  onSuccess: (coords: { latitude: number; longitude: number }) => void;
  onError: (permission: "denied" | "prompt") => void;
  onStatus?: (message: string, tone?: LocateStatusTone) => void;
};

type GeoResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number }
  | { ok: false; code: number; message: string };

const GEO_OPTIONS_HIGH: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 30_000,
};

const GEO_OPTIONS_LOW: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 60_000,
};

function getPosition(options: PositionOptions): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ ok: false, code: 2, message: "Geolocation unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => resolve({ ok: false, code: error.code, message: error.message }),
      options,
    );
  });
}

/**
 * Custom locate control — MapLibre's GeolocateControl crashes when
 * `showUserLocation: false` and the fix falls outside `maxBounds`.
 */
export class LocateControl implements IControl {
  private map: MapLibreMap | undefined;
  private container: HTMLDivElement | undefined;
  private button: HTMLButtonElement | undefined;
  private busy = false;
  private readonly handlers: LocateHandlers;

  constructor(handlers: LocateHandlers) {
    this.handlers = handlers;
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "maplibregl-ctrl-geolocate";
    this.button.title = "Find my location";
    this.button.setAttribute("aria-label", "Find my location");

    const icon = document.createElement("span");
    icon.className = "maplibregl-ctrl-icon";
    icon.setAttribute("aria-hidden", "true");
    this.button.appendChild(icon);
    this.button.addEventListener("click", this.handleClick);
    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove(): void {
    this.button?.removeEventListener("click", this.handleClick);
    this.container?.parentNode?.removeChild(this.container);
    this.button = undefined;
    this.container = undefined;
    this.map = undefined;
  }

  private clearBusyClasses = () => {
    this.button?.classList.remove(
      "maplibregl-ctrl-geolocate-waiting",
      "maplibregl-ctrl-geolocate-active",
      "maplibregl-ctrl-geolocate-active-error",
    );
  };

  private setWaiting = () => {
    this.clearBusyClasses();
    this.button?.classList.add(
      "maplibregl-ctrl-geolocate-active",
      "maplibregl-ctrl-geolocate-waiting",
    );
  };

  private setErrorFlash = () => {
    this.button?.classList.remove(
      "maplibregl-ctrl-geolocate-waiting",
      "maplibregl-ctrl-geolocate-active",
    );
    this.button?.classList.add("maplibregl-ctrl-geolocate-active-error");
    window.setTimeout(() => this.clearBusyClasses(), 2200);
  };

  private handleClick = () => {
    void this.locate();
  };

  private locate = async () => {
    if (!this.map || !this.button || this.busy) return;
    this.busy = true;

    if (!window.isSecureContext) {
      this.handlers.onStatus?.(
        "Location needs http://localhost or HTTPS — not a LAN IP like 192.168.x.x",
        "error",
      );
      this.handlers.onError("denied");
      this.setErrorFlash();
      this.busy = false;
      return;
    }

    if (!("geolocation" in navigator)) {
      this.handlers.onStatus?.("This browser does not support geolocation", "error");
      this.handlers.onError("denied");
      this.setErrorFlash();
      this.busy = false;
      return;
    }

    this.setWaiting();
    this.handlers.onStatus?.("Finding your location…", "neutral");

    let result = await getPosition(GEO_OPTIONS_HIGH);
    // Desktops often time out on GPS/high-accuracy — fall back to network/Wi‑Fi.
    if (!result.ok && (result.code === 3 || result.code === 2)) {
      this.handlers.onStatus?.("Retrying with network location…", "neutral");
      result = await getPosition(GEO_OPTIONS_LOW);
    }

    if (!result.ok) {
      if (result.code === 1) {
        this.handlers.onStatus?.(
          "Location permission blocked — allow it for this site in browser settings",
          "error",
        );
        this.handlers.onError("denied");
      } else {
        this.handlers.onStatus?.(
          `Could not read location (${result.message || "timeout"}). Try without VPN or check OS location services.`,
          "error",
        );
        this.handlers.onError("prompt");
      }
      this.setErrorFlash();
      this.busy = false;
      return;
    }

    const { latitude, longitude, accuracy } = result;
    this.handlers.onSuccess({ latitude, longitude });
    this.button.classList.remove("maplibregl-ctrl-geolocate-waiting");

    if (isWithinAthensCatalog(latitude, longitude)) {
      this.button.classList.add("maplibregl-ctrl-geolocate-active");
      this.map.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(this.map.getZoom(), INITIAL_FOCUS_ZOOM),
        duration: 900,
      });
      this.handlers.onStatus?.(
        `Location found (±${Math.round(accuracy)}m)`,
        "neutral",
      );
      this.busy = false;
      return;
    }

    // Browser/VPN reported a point outside the Athens-locked map.
    this.map.easeTo({
      center: ATHENS_CENTER,
      zoom: Math.max(this.map.getZoom(), ATHENS_INITIAL_ZOOM),
      duration: 600,
    });
    this.handlers.onStatus?.(
      `Browser located you outside Athens (${latitude.toFixed(2)}, ${longitude.toFixed(2)}). Map stays on Athens — often caused by VPN/IP geolocation.`,
      "error",
    );
    window.setTimeout(() => this.clearBusyClasses(), 700);
    this.busy = false;
  };
}
