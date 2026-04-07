"use client";

import { useMemo } from "react";
import { List, type RowComponentProps } from "react-window";
import { StoreCard } from "@/components/StoreCard";
import { getMerchantId, type ILocale, type MerchantFeature } from "@/types";
import { LOCALE } from "@/lib";
import { SKELETON_ITEM_COUNT, STORE_LIST_ROW_HEIGHT } from "@/lib/config";
import styles from "./ResultsPanel.module.scss";

type ResultsPanelProps = {
  merchants: MerchantFeature[];
  selectedId: string | null;
  loading: boolean;
  height?: number;
  onSelect: (merchant: MerchantFeature) => void;
  title: string;
  storesLabel: string;
  noResultsLabel: string;
  noAddressLabel: string;
  locale: ILocale;
};

type RowData = {
  merchants: MerchantFeature[];
  selectedId: string | null;
  onSelect: (merchant: MerchantFeature) => void;
  locale: ILocale;
  noAddressLabel: string;
};

function Row({
  index,
  style,
  merchants,
  selectedId,
  onSelect,
  locale,
  noAddressLabel
}: RowComponentProps<RowData>) {
  const merchant = merchants[index];
  const selected = selectedId === getMerchantId(merchant);
  return (
    <div role="listitem" style={style} className={styles.rowItem}>
      <StoreCard
        merchant={merchant}
        selected={selected}
        locale={locale}
        noAddressLabel={noAddressLabel}
        onSelect={onSelect}
      />
    </div>
  );
}

export function ResultsPanel({
  merchants,
  selectedId,
  loading,
  onSelect,
  height = 480,
  title,
  storesLabel,
  noResultsLabel,
  noAddressLabel,
  locale
}: ResultsPanelProps) {
  const itemData = useMemo<RowData>(
    () => ({
      merchants,
      selectedId,
      onSelect,
      locale,
      noAddressLabel
    }),
    [locale, merchants, noAddressLabel, onSelect, selectedId]
  );

  return (
    <section
      aria-label={title}
      className={styles.panel}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>
          {merchants.length.toLocaleString(locale === LOCALE.EL ? "el-GR" : "en-US")}{" "}
          {storesLabel}
        </span>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading stores" className={styles.skeletonContainer}>
          {Array.from({ length: SKELETON_ITEM_COUNT }).map((_, idx) => (
            <div
              key={idx}
              className={styles.skeletonItem}
            />
          ))}
        </div>
      ) : merchants.length === 0 ? (
        <div className={styles.emptyState}>
          {noResultsLabel}
        </div>
      ) : (
        <div role="list">
          <List
            rowComponent={Row}
            rowCount={merchants.length}
            rowHeight={STORE_LIST_ROW_HEIGHT}
            rowProps={itemData}
            style={{ height, width: "100%" }}
          />
        </div>
      )}
    </section>
  );
}
