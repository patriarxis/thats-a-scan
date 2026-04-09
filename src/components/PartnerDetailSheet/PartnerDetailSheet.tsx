import {
  Navigation,
  Share2,
  Phone,
  Globe,
  UtensilsCrossed,
  WalletCards,
  CreditCard,
  Facebook,
  Linkedin,
  Instagram,
  X
} from "lucide-react";
import { useMemo } from "react";
import {
  getPartnerAddress,
  getPartnerName,
  type PartnerDetailSheetProps,
} from "@/types";
import styles from "./PartnerDetailSheet.module.scss";

export const PartnerDetailSheet = ({
  partner,
  isMobile,
  locale,
  labels,
  onClose
}: PartnerDetailSheetProps) => {
  const address = partner ? getPartnerAddress(partner, locale) : "";
  const [lng, lat] = partner?.geometry.coordinates ?? [0, 0];
  const googleMapsUrl = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    [lat, lng],
  );
  const appleMapsUrl = useMemo(
    () => `https://maps.apple.com/?q=${lat},${lng}`,
    [lat, lng],
  );

  const handleShare = async () => {
    const shareData = {
      title: partner ? getPartnerName(partner, locale) : "Up Hellas Partner",
      text: address,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      }
    } catch {
      // Share failed
    }
  };

  const handleOpenMaps = () => {
    const isApplePlatform = /iPad|iPhone|iPod|Mac/i.test(navigator.userAgent);
    const targetUrl = isApplePlatform ? appleMapsUrl : googleMapsUrl;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  if (!partner) return null;

  const props = partner.properties;
  const phone = (props.Phone || props.Tel || props.Telephone) as string;
  const website = (props.Url || props.Website || props.Web) as string;
  const facebook = props.FacebookUrl as string;
  const linkedin = props.LinkedinUrl as string;
  const instagram = props.InstagramUrl as string;
  const description = (props.DescriptionGR || props.DescriptionEN || props.Description) as string;

  const networks = [
    { id: "meal", label: labels.categoryMeal, icon: UtensilsCrossed, color: "orange" },
    { id: "cashback", label: labels.cashback, icon: WalletCards, color: "orange" },
    { id: "flexone", label: labels.flexone, icon: CreditCard, color: "purple" },
  ];

  return (
    <aside
      role={isMobile ? "dialog" : "region"}
      aria-modal={isMobile ? true : undefined}
      aria-label="Partner details panel"
      className={`${styles.sheet} ${isMobile ? styles.sheetMobile : ""}`}
    >
      <div className={styles.header}>
        <div className={styles.headerTitleArea}>
          <h4 className={styles.partnerName}>
            {getPartnerName(partner, locale)}
          </h4>
          <p className={styles.addressSubtitle}>
            {address || labels.noAddress}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={handleShare} className={styles.headerActionBtn}>
            <Share2 size={18} />
          </button>
          <button type="button" onClick={onClose} className={styles.headerActionBtn}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.networksRow}>
          {networks.map(net => (
            <span key={net.id} className={`${styles.networkChip} ${styles[net.color]}`}>
              <net.icon size={14} />
              {net.label}
            </span>
          ))}
        </div>

        {description && (
          <div className={styles.descriptionSection}>
            <p className={styles.description}>{description}</p>
          </div>
        )}

        <div className={styles.actionGrid}>
          <button type="button" onClick={handleOpenMaps} className={styles.actionPill}>
            <Navigation size={16} />
            <span>{labels.openMaps}</span>
          </button>

          {phone && (
            <a href={`tel:${phone}`} className={styles.actionPill}>
              <Phone size={16} />
              <span>{labels.phone}</span>
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" className={styles.actionPill}>
              <Globe size={16} />
              <span>{labels.website}</span>
            </a>
          )}
          {facebook && (
            <a href={facebook} target="_blank" rel="noreferrer" className={styles.actionPill}>
              <Facebook size={16} />
              <span>{labels.facebook}</span>
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noreferrer" className={styles.actionPill}>
              <Linkedin size={16} />
              <span>{labels.linkedin}</span>
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noreferrer" className={styles.actionPill}>
              <Instagram size={16} />
              <span>{labels.instagram}</span>
            </a>
          )}
        </div>
      </div>
    </aside>
  );
};

export const MerchantDetailSheet = PartnerDetailSheet;
export const StoreDetailSheet = PartnerDetailSheet;
