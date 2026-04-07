"use client";

import { Copy, Heart, MapPinned, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type ILocale,
  type MerchantFeature
} from "@/types";
import { COPIED_FEEDBACK_DURATION_MS } from "@/lib/config";
import styles from "./StoreDetailSheet.module.scss";

type StoreDetailSheetProps = {
  merchant: MerchantFeature | null;
  isMobile?: boolean;
  locale: ILocale;
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
      // Clipboard write failed
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
      className={`${styles.sheet} ${isMobile ? styles.sheetMobile : ""}`}
    >
      <div className={styles.headerRow}>
        <div>
          <p className={styles.categoryLabel}>
            {labels.merchantDetail}
          </p>
          <h4 className={styles.merchantName}>
            {getMerchantName(merchant, locale)}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeBtn}
        >
          {labels.close}
        </button>
      </div>

      <div className={styles.addressBlock}>
        <p className={styles.addressLabel}>{labels.address}</p>
        <p className={styles.addressValue}>
          {address || labels.noAddress}
        </p>
      </div>

      <div className={styles.actionsGrid}>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.openMapsBtn}
        >
          <Navigation className={styles.actionIcon} />
          {labels.openMaps}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className={styles.copyBtn}
          aria-label="Copy address"
        >
          <Copy className={styles.actionIcon} />
          {copied ? labels.copied : labels.copy}
        </button>
        <button
          type="button"
          onClick={handleFavoriteToggle}
          aria-pressed={favorite}
          className={`${styles.favoriteBtn} ${favorite ? styles.favoriteBtnActive : ""}`}
          aria-label="Favorite store"
        >
          <Heart className={styles.actionIcon} />
          {favorite ? labels.saved : labels.favorite}
        </button>
        <div className={styles.coordsDisplay}>
          <MapPinned className={styles.actionIcon} />
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
      </div>
    </aside>
  );
}
