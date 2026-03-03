"use client";

import { Copy, Heart, MapPinned, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type Locale,
  type MerchantFeature
} from "@/types/merchant";
import { COPIED_FEEDBACK_DURATION_MS } from "@/lib/config";

type StoreDetailSheetProps = {
  merchant: MerchantFeature | null;
  isMobile?: boolean;
  locale: Locale;
  labels: {
    merchantDetail: string;
    close: string;
    address: string;
    noAddress: string;
    openMaps: string;
    copy: string;
    copied: string;
    favorite: string;
    saved: string;
  };
  onClose: () => void;
};

export function StoreDetailSheet({
  merchant,
  isMobile,
  locale,
  labels,
  onClose
}: StoreDetailSheetProps) {
  const merchantId = merchant ? getMerchantId(merchant) : null;
  const [favorite, setFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync favorite state from localStorage when the selected merchant changes
  useEffect(() => {
    if (!merchantId) {
      setFavorite(false);
      return;
    }
    try {
      setFavorite(localStorage.getItem(`favorite:${merchantId}`) === "true");
    } catch {
      setFavorite(false);
    }
  }, [merchantId]);

  const address = merchant ? getMerchantAddress(merchant, locale) : "";
  const [lng, lat] = merchant?.geometry.coordinates ?? [0, 0];
  const mapsUrl = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    [lat, lng]
  );

  if (!merchant) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address || `${lat}, ${lng}`);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      // Clipboard write failed (e.g. permission denied or HTTP context)
    }
  };

  const handleFavoriteToggle = () => {
    const next = !favorite;
    setFavorite(next);
    if (merchantId) {
      try {
        if (next) {
          localStorage.setItem(`favorite:${merchantId}`, "true");
        } else {
          localStorage.removeItem(`favorite:${merchantId}`);
        }
      } catch {
        // localStorage unavailable
      }
    }
  };

  return (
    <aside
      role={isMobile ? "dialog" : "region"}
      aria-modal={isMobile ? true : undefined}
      aria-label="Store details panel"
      className={`z-20 rounded-3xl border border-white/55 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/90 ${
        isMobile ? "w-full rounded-b-none border-b-0" : ""
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            {labels.merchantDetail}
          </p>
          <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            {getMerchantName(merchant, locale)}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {labels.close}
        </button>
      </div>

      <div className="mb-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
        <p className="text-xs text-slate-500 dark:text-slate-400">{labels.address}</p>
        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
          {address || labels.noAddress}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Navigation className="h-4 w-4" />
          {labels.openMaps}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Copy address"
        >
          <Copy className="h-4 w-4" />
          {copied ? labels.copied : labels.copy}
        </button>
        <button
          type="button"
          onClick={handleFavoriteToggle}
          aria-pressed={favorite}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            favorite
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
          aria-label="Favorite store"
        >
          <Heart className="h-4 w-4" />
          {favorite ? labels.saved : labels.favorite}
        </button>
        <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <MapPinned className="h-4 w-4" />
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
      </div>
    </aside>
  );
}
