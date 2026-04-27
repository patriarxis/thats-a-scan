import { MapPin } from "@phosphor-icons/react";
import {
  getPartnerAddress,
  getPartnerId,
  getPartnerName,
  type ILocale,
  type PartnerFeature
} from "@/types";
import styles from "./PartnerCard.module.scss";

type MerchantCardProps = {
  partner: PartnerFeature;
  selected: boolean;
  locale: ILocale;
  noAddressLabel: string;
  onSelect: (partner: PartnerFeature) => void;
};

export const MerchantCard = ({
  partner,
  selected,
  locale,
  noAddressLabel,
  onSelect
}: MerchantCardProps) => {
  const name = getPartnerName(partner, locale);
  const address = getPartnerAddress(partner, locale);

  return (
    <button
      type="button"
      onClick={() => onSelect(partner)}
      aria-pressed={selected}
      aria-label={`${name}${address ? `, ${address}` : ""}`}
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
    >
      <div className={styles.cardInner}>
        <div className={styles.iconWrapper}>
          <MapPin
            className={styles.pinIcon}
            weight="fill"
            aria-hidden
          />
        </div>
        <div className={styles.textContent}>
          <p className={styles.name}>
            {name}
          </p>
          <p className={styles.address}>
            {address || noAddressLabel}
          </p>
          <p className={styles.merchantId}>
            ID: {getPartnerId(partner)}
          </p>
        </div>
      </div>
    </button>
  );
};
