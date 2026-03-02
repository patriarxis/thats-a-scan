"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap, Marker as MapboxMarker, Popup as MapboxPopup, type LngLatLike } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type GeoJSONFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id?: string | number;
    name?: string;
    address?: string;
    city?: string;
    category?: string;
  } & Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

const DEFAULT_CENTER: LngLatLike = [23.7275, 37.9838]; // Athens

export function MapView() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const popupRef = useRef<MapboxPopup | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/merchants-geojson");
        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to fetch merchants", text);
          setError("Αποτυχία φόρτωσης καταστημάτων. Δοκίμασε ξανά.");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error fetching merchants", err);
        setError("Σφάλμα σύνδεσης. Ελέγξε τη σύνδεσή σου και δοκίμασε ξανά.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: 6
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!mapRef.current || !data) return;

    // Clear existing markers and popup
    popupRef.current?.remove();
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const name = feature.properties.name ?? "Κατάστημα";
      const address = [feature.properties.address, feature.properties.city].filter(Boolean).join(", ");
      const category = feature.properties.category ? String(feature.properties.category) : null;

      const el = document.createElement("div");
      el.className = "up-marker";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "50%";
      el.style.background = "linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%)";
      el.style.boxShadow = "0 4px 14px rgba(255, 107, 53, 0.4)";
      el.style.border = "3px solid #ffffff";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = "pointer";
      el.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";

      const inner = document.createElement("div");
      inner.style.width = "10px";
      inner.style.height = "10px";
      inner.style.borderRadius = "50%";
      inner.style.backgroundColor = "#ffffff";
      el.appendChild(inner);

      el.onmouseenter = () => {
        el.style.transform = "scale(1.15)";
        el.style.boxShadow = "0 6px 20px rgba(255, 107, 53, 0.5)";
      };
      el.onmouseleave = () => {
        el.style.transform = "scale(1)";
        el.style.boxShadow = "0 4px 14px rgba(255, 107, 53, 0.4)";
      };

      el.onclick = (e) => {
        e.stopPropagation();

        // Remove existing popup
        popupRef.current?.remove();

        // Create popup content
        const popupHTML = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 0;">
            <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">${name}</div>
            ${address ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${address}</div>` : ""}
            ${category ? `<div style="display: inline-block; background: linear-gradient(135deg, #5b34ff 0%, #7c5cff 100%); color: white; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px;">${category}</div>` : ""}
          </div>
        `;

        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 20,
          className: "up-popup"
        })
          .setLngLat([lng, lat])
          .setHTML(popupHTML);

        const map = mapRef.current;
        if (map) {
          popup.addTo(map);
          popupRef.current = popup;
          map.flyTo({ center: [lng, lat], zoom: 14 });
        }
      };

      const map = mapRef.current;
      if (map) {
        const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      }
    });
  }, [data]);

  if (!token) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-[32px] border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50 to-white">
        <div className="text-center px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-base font-medium text-slate-800 mb-2">Ο χάρτης δεν είναι διαθέσιμος</p>
          <p className="text-sm text-slate-500">
            Πρόσθεσε το <code className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> στο{" "}
            <code className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs">.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-6 text-center">
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-orange-500/25">
          Δίκτυο Συνεργατών
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">
          Βρες το κατάστημα που σε <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">ενδιαφέρει</span>
        </h2>
        <p className="mt-2 text-slate-500">
          Πάτησε σε ένα σημείο για να δεις λεπτομέρειες
        </p>
      </div>

      {/* Map Container */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-2xl shadow-slate-200/50">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="inline-flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-600">Φορτώνουμε τα καταστήματα...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="text-center px-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-3">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Map */}
        <div ref={mapContainerRef} className="h-[70vh] w-full" />

        {/* Stats Badge */}
        {data && !loading && (
          <div className="absolute bottom-6 left-6 z-10">
            <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm border border-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/30">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Καταστήματα</p>
                <p className="text-lg font-bold text-slate-900">{data.features.length.toLocaleString("el-GR")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Popup Styles */}
      <style jsx global>{`
        .up-popup .mapboxgl-popup-content {
          padding: 16px 20px;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        .up-popup .mapboxgl-popup-close-button {
          font-size: 20px;
          color: #94a3b8;
          padding: 4px 10px;
          right: 4px;
          top: 4px;
        }
        .up-popup .mapboxgl-popup-close-button:hover {
          color: #0f172a;
          background: transparent;
        }
        .up-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}

