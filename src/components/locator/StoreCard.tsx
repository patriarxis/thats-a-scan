import { MapPin } from "lucide-react";
import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type Locale,
  type MerchantFeature
} from "@/types/merchant";

type StoreCardProps = {
  merchant: MerchantFeature;
  selected: boolean;
  locale: Locale;
  noAddressLabel: string;
  onSelect: (merchant: MerchantFeature) => void;
};

export function StoreCard({
  merchant,
  selected,
  locale,
  noAddressLabel,
  onSelect
}: StoreCardProps) {
  const name = getMerchantName(merchant, locale);
  const address = getMerchantAddress(merchant, locale);

  return (
    <button
      type="button"
      onClick={() => onSelect(merchant)}
      aria-pressed={selected}
      aria-label={`${name}${address ? `, ${address}` : ""}`}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
        selected
          ? "border-violet-300 bg-violet-50/90 shadow-sm dark:border-violet-500/60 dark:bg-violet-500/15"
          : "border-slate-800/80 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900/95 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {address || noAddressLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            ID: {getMerchantId(merchant)}
          </p>
        </div>
      </div>
    </button>
  );
}
