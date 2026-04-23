"use client";

import { useMemo } from "react";
import { List, type RowComponentProps } from "react-window";
import { PartnerCard } from "@/components";
import { getPartnerId, type ILocale, type PartnerFeature } from "@/types";
import { LOCALE } from "@/lib";
import { SKELETON_ITEM_COUNT, STORE_LIST_ROW_HEIGHT } from "@/lib/config";
import styles from "./PartnerResultsPanel.module.scss";

type PartnerResultsPanelProps = {
  partners: PartnerFeature[];
  selectedId: string | null;
  loading: boolean;
  height?: number;
  onSelect: (partner: PartnerFeature) => void;
  title: string;
  storesLabel: string;
  noResultsLabel: string;
  noAddressLabel: string;
  locale: ILocale;
};

type RowData = {
  partners: PartnerFeature[];
  selectedId: string | null;
  onSelect: (partner: PartnerFeature) => void;
  locale: ILocale;
  noAddressLabel: string;
};

const Row = ({
  index,
  style,
  partners,
  selectedId,
  onSelect,
  locale,
  noAddressLabel
}: RowComponentProps<RowData>) => {
  const partner = partners[index];
  const selected = selectedId === getPartnerId(partner);
  return (
    <div role="listitem" style={style} className={styles.rowItem}>
      <PartnerCard
        partner={partner}
        selected={selected}
        locale={locale}
        noAddressLabel={noAddressLabel}
        onSelect={onSelect}
      />
    </div>
  );
};

export const PartnerResultsPanel = ({
  partners,
  selectedId,
  loading,
  onSelect,
  height = 480,
  title,
  storesLabel,
  noResultsLabel,
  noAddressLabel,
  locale
}: PartnerResultsPanelProps) => {
  const itemData = useMemo<RowData>(
    () => ({
      partners,
      selectedId,
      onSelect,
      locale,
      noAddressLabel
    }),
    [locale, noAddressLabel, onSelect, partners, selectedId]
  );

  return (
    <section
      aria-label={title}
      className={styles.panel}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>
          {partners.length.toLocaleString(locale === LOCALE.EL ? "el-GR" : "en-US")}{" "}
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
      ) : partners.length === 0 ? (
        <div className={styles.emptyState}>
          {noResultsLabel}
        </div>
      ) : (
        <div role="list">
          <List
            rowComponent={Row}
            rowCount={partners.length}
            rowHeight={STORE_LIST_ROW_HEIGHT}
            rowProps={itemData}
            style={{ height, width: "100%" }}
          />
        </div>
      )}
    </section>
  );
};
