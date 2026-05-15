import React, { useMemo, useState, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  getPartnerAddress,
  getPartnerName,
  isPartnerDigital,
  type MerchantDetailSheetProps,
} from "@/types";
import {
  resolveMerchantAcceptedProductIds,
  merchantHasCashback,
} from "@/lib/merchantFilters";
import {
  getMerchantCategoryLabel,
  resolveMerchantCategorization,
} from "@/lib/merchantCategorization";
import { Icon, IconButton } from "@/components/ui";
import { RichText } from "../RichText";
import styles from "./PartnerDetailContent.module.scss";
import { ICONS, LOCALE } from "@/enums";
import flexoneLogo from "@/assets/products/flexone-logo.webp";
import fitpassLogo from "@/assets/products/fitpass-logo.svg";
import goForEatLogo from "@/assets/products/go-for-eat-logo.svg";
import upGiftLogo from "@/assets/products/up-gift-logo.svg";
import chequeDejeunerLogo from "@/assets/products/cheque-dejeuner-logo.svg";

interface MerchantDetailContentProps extends MerchantDetailSheetProps {
  className?: string;
}

type MerchantTag = {
  id: string;
  label: string;
  type: "meal" | "rewards" | "expenses" | "gyms" | "cashback";
};

type ProductLogo = {
  id: string;
  label: string;
  src: string;
  type: string;
};

type ProductLogoAsset = string | { src: string };

const getProductLogoSrc = (asset: ProductLogoAsset) =>
  typeof asset === "string" ? asset : asset.src;

const PRODUCT_LOGO_SOURCES: Partial<Record<string, string>> = {
  flexone: getProductLogoSrc(flexoneLogo),
  fitpass: getProductLogoSrc(fitpassLogo),
  "go-for-eat": getProductLogoSrc(goForEatLogo),
  "up-gift": getProductLogoSrc(upGiftLogo),
  "cheque-dejeuner": getProductLogoSrc(chequeDejeunerLogo),
};

const PRODUCT_LOGO_PRIORITY = [
  "flexone",
  "go-for-eat",
  "up-gift",
  "fitpass",
  "cheque-dejeuner",
] as const;

const PRODUCT_LOGO_PRIORITY_INDEX: ReadonlyMap<string, number> = new Map(
  PRODUCT_LOGO_PRIORITY.map((productId, index) => [productId, index]),
);

export const MerchantDetailContent = ({
  partner,
  locale,
  labels,
  onClose,
  className,
}: MerchantDetailContentProps) => {
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  const isDigitalPartner = partner ? isPartnerDigital(partner) : false;
  const address = partner ? getPartnerAddress(partner, locale) : "";
  const subtitle = isDigitalPartner ? labels.digitalOnly : (address || labels.noAddress);
  const [lng, lat] = partner?.geometry.coordinates ?? [0, 0];

  useEffect(() => {
    setIsBioExpanded(false);
    if (emblaApi) {
      emblaApi.scrollTo(0, true);
    }
  }, [partner?.properties?.ID, emblaApi]);

  useEffect(() => {
    if (descriptionRef.current) {
      const hasOverflow = descriptionRef.current.scrollHeight > 120;
      setShouldShowToggle(hasOverflow);
    }
  }, [partner]);

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
    const fallbackText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;

    const copyToClipboard = async () => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fallbackText);
        return;
      }

      const textarea = document.createElement("textarea");
      textarea.value = fallbackText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    try {
      if (navigator.share) {
        const shareCandidates: ShareData[] = [
          shareData,
          {
            title: shareData.title,
            text: `${shareData.text}\n${shareData.url}`.trim(),
          },
          {
            text: `${shareData.title}\n${shareData.text}\n${shareData.url}`.trim(),
          },
        ];

        const canUseCandidate = (candidate: ShareData) =>
          typeof navigator.canShare !== "function" || navigator.canShare(candidate);

        let lastShareError: unknown = null;
        for (const candidate of shareCandidates) {
          if (!canUseCandidate(candidate)) continue;
          try {
            await navigator.share(candidate);
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            lastShareError = error;
          }
        }

        if (lastShareError) {
          throw lastShareError;
        }
      }
      await copyToClipboard();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyToClipboard();
      } catch {
      }
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
  const tiktok = (props.TikTokUrl || props.TiktokUrl || props.Tiktok) as string;
  const featuredPhoto = props.featured_photo as string;

  const categorization = resolveMerchantCategorization(partner.properties);
  const category = categorization.networkCategoryId;
  const primaryCategoryLabel = getMerchantCategoryLabel(
    categorization.primaryCategoryId,
    locale,
  );
  const description = useMemo(() => {
    if (category === "gyms") {
      const localeDescription =
        locale === LOCALE.EL
          ? props.DescriptionGR
          : props.DescriptionEN || props.Description;
      return String(localeDescription ?? "").trim();
    }

    return String(
      props.DescriptionGR || props.DescriptionEN || props.Description || ""
    ).trim();
  }, [
    category,
    locale,
    props.Description,
    props.DescriptionEN,
    props.DescriptionGR,
  ]);

  const acceptedProducts = useMemo(() => resolveMerchantAcceptedProductIds(partner), [partner]);

  const hasCashback = merchantHasCashback(partner);

  const { tags, productLogos } = useMemo(() => {
    const tagItems: MerchantTag[] = [];
    const logoItems: ProductLogo[] = [];

    tagItems.push({
      id: "category",
      label: primaryCategoryLabel,
      type: category,
    });

    if (hasCashback) {
      tagItems.push({
        id: "cashback",
        label: labels.cashback,
        type: "cashback",
      });
    }

    [...acceptedProducts].sort((a, b) => {
      const aPriority = PRODUCT_LOGO_PRIORITY_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = PRODUCT_LOGO_PRIORITY_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;

      return aPriority - bPriority;
    }).forEach((productId) => {
      const src = PRODUCT_LOGO_SOURCES[productId];
      if (!src) return;

      let label: string = productId;

      if (productId === "flexone") {
        label = labels.flexone;
      } else if (productId === "fitpass") {
        label = labels.fitpass;
      } else if (productId === "go-for-eat") {
        label = labels.goForEat;
      } else if (productId === "cheque-dejeuner") {
        label = "Chèque Déjeuner";
      } else if (productId === "up-gift") {
        label = labels.upGift;
      }

      logoItems.push({
        id: productId,
        label,
        src,
        type: productId.replace(/\s+/g, "-"),
      });
    });

    return { tags: tagItems, productLogos: logoItems };
  }, [acceptedProducts, category, hasCashback, labels, primaryCategoryLabel]);

  return (
    <div className={`${styles.content} ${className || ""}`}>
      <div className={styles.header}>
        <div className={styles.headerBody}>
          {featuredPhoto && (
            <div className={styles.logo}>
              <img
                src={featuredPhoto}
                alt={getPartnerName(partner, locale)}
                className={styles.logoImg}
              />
            </div>
          )}
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{getPartnerName(partner, locale)}</h2>
            <p className={styles.subtitle}>{subtitle}</p>
            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className={`${styles.tag} ${styles[tag.type]}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
            {productLogos.length > 0 && (
              <div className={styles.productStack}>
                {productLogos.map((logo, index) => (
                  <div
                    key={logo.id}
                    className={`${styles.productLogo} ${styles[logo.type]}`}
                    title={logo.label}
                    style={{
                      "--product-logo-z-index": productLogos.length - index,
                    } as React.CSSProperties}
                  >
                    <img
                      src={logo.src}
                      alt=""
                      aria-hidden="true"
                      className={styles.productLogoImg}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <IconButton
          icon={ICONS.X}
          variant="ghost"
          size="sm"
          className={styles.closeButton}
          aria-label={labels.close}
          onClick={onClose}
        />
      </div>

      <div className={styles.actions}>
        {!isDigitalPartner && (
          <button
            type="button"
            onClick={handleOpenMaps}
            className={`${styles.actionCard} ${styles.primary} ${styles.maps}`}
          >
            <Icon name={ICONS.NAVIGATION_ARROW} width={22} height={22} />
            <span>{labels.openMaps}</span>
          </button>
        )}

        {phone && (
          <a
            href={`tel:${phone}`}
            className={`${styles.actionCard} ${styles.primary}`}
          >
            <Icon name={ICONS.PHONE} width={22} height={22} />
            <span>{labels.phone}</span>
          </a>
        )}

        {website && (
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            className={`${styles.actionCard} ${styles.secondary}`}
          >
            <Icon name={ICONS.GLOBE} width={16} height={16} />
          </a>
        )}
        {instagram && (
          <a
            href={instagram}
            target="_blank"
            rel="noreferrer"
            className={`${styles.actionCard} ${styles.secondary}`}
          >
            <Icon name={ICONS.INSTAGRAM} width={16} height={16} />
          </a>
        )}
        {facebook && (
          <a
            href={facebook}
            target="_blank"
            rel="noreferrer"
            className={`${styles.actionCard} ${styles.secondary}`}
          >
            <Icon name={ICONS.FACEBOOK} width={16} height={16} />
          </a>
        )}
        {linkedin && (
          <a
            href={linkedin}
            target="_blank"
            rel="noreferrer"
            className={`${styles.actionCard} ${styles.secondary}`}
          >
            <Icon name={ICONS.LINKEDIN} width={16} height={16} />
          </a>
        )}
        {tiktok && (
          <a
            href={tiktok}
            target="_blank"
            rel="noreferrer"
            className={`${styles.actionCard} ${styles.secondary}`}
            aria-label="TikTok"
          >
            <Icon name={ICONS.TIKTOK} width={16} height={16} />
          </a>
        )}
        <button
          type="button"
          onClick={handleShare}
          className={`${styles.actionCard} ${styles.secondary} ${styles.share}`}
          aria-label={labels.share}
        >
          <Icon name={ICONS.SHARE_NETWORK} width={16} height={16} />
        </button>
      </div>

      {description && (
        <div className={styles.bioSection}>
          <div className={styles.bioBox}>
            <div
              ref={descriptionRef}
              className={`${styles.bioBody} ${!isBioExpanded && shouldShowToggle ? styles.truncated : ""
                }`}
            >
              <RichText content={description} className={styles.description} />
            </div>
            {shouldShowToggle && (
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsBioExpanded(!isBioExpanded)}
              >
                {isBioExpanded ? "Read less" : "Read more"}
              </button>
            )}
          </div>
        </div>
      )}

      {Array.isArray(props.extra_photos) && props.extra_photos.length > 0 && (
        <div className={styles.gallerySection}>
          <div className={styles.gallery} ref={emblaRef}>
            <div className={styles.galleryContainer}>
              {(props.extra_photos as string[]).map((photo, idx) => (
                <div key={idx} className={styles.gallerySlide}>
                  <img
                    src={photo}
                    alt={`${getPartnerName(partner, locale)} ${idx + 1}`}
                    className={styles.galleryImg}
                  />
                </div>
              ))}
              <div
                className={styles.galleryEndSpacer}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
