"use client";

import { useMemo } from "react";
import { List, type RowComponentProps } from "react-window";
import { StoreCard } from "@/components/locator/StoreCard";
import { getMerchantId, type Locale, type MerchantFeature } from "@/types/merchant";

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
  locale: Locale;
};

type RowData = {
  merchants: MerchantFeature[];
  selectedId: string | null;
  onSelect: (merchant: MerchantFeature) => void;
  locale: Locale;
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
    <div style={style} className="px-2 py-1.5">
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
    <section className="rounded-3xl border border-white/55 bg-white/85 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="mb-3 flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {merchants.length.toLocaleString(locale === "el" ? "el-GR" : "en-US")}{" "}
          {storesLabel}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 px-2 py-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : merchants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
          {noResultsLabel}
        </div>
      ) : (
        <List
          rowComponent={Row}
          rowCount={merchants.length}
          rowHeight={98}
          rowProps={itemData}
          style={{ height, width: "100%" }}
        />
      )}
    </section>
  );
}
