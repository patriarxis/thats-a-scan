import { MapPin } from "lucide-react";
import {
  getMerchantAddress,
  getMerchantId,
  getMerchantName,
  type ILocale,
  type MerchantFeature
} from "@/types";
import styles from "./StoreCard.module.scss";

type StoreCardProps = {
  merchant: MerchantFeature;
  selected: boolean;
  locale: ILocale;
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
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
    >
      <div className={styles.cardInner}>
        <div className={styles.iconWrapper}>
          <MapPin className={styles.pinIcon} />
        </div>
        <div className={styles.textContent}>
          <p className={styles.name}>
            {name}
          </p>
          <p className={styles.address}>
            {address || noAddressLabel}
          </p>
          <p className={styles.merchantId}>
            ID: {getMerchantId(merchant)}
          </p>
        </div>
      </div>
    </button>
  );
}
