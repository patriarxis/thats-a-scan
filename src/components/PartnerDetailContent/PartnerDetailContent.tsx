import React, { useMemo, useState, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  getPartnerAddress,
  getPartnerName,
  isPartnerDigital,
  type PartnerDetailSheetProps,
} from "@/types";
import {
  resolveMerchantCategory,
  resolveMerchantProductIds,
  merchantHasCashback,
} from "@/lib/merchantFilters";
import { Icon } from "@/components/ui";
import { RichText } from "../RichText";
import styles from "./PartnerDetailContent.module.scss";
import { ICONS, LOCALE } from "@/enums";

interface PartnerDetailContentProps extends PartnerDetailSheetProps {
  className?: string;
}

type PartnerTag = {
  id: string;
  label: string;
  type: "meal" | "rewards" | "expenses" | "gyms" | "cashback";
};

type ProductLogo = {
  id: string;
  label: string;
  initials: string;
  type: string;
};

export const PartnerDetailContent = ({
  partner,
  locale,
  labels,
  onClose,
  className,
}: PartnerDetailContentProps) => {
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
      // AbortError means user closed the native share sheet.
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyToClipboard();
      } catch {
        // No available sharing fallback.
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

  const category = resolveMerchantCategory(partner);
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

  const acceptedProducts = useMemo(() => resolveMerchantProductIds(partner), [partner]);

  const hasCashback = merchantHasCashback(partner);

  const { tags, productLogos } = useMemo(() => {
    const tagItems: PartnerTag[] = [];
    const logoItems: ProductLogo[] = [];

    switch (category) {
      case "meal":
        tagItems.push({
          id: "category",
          label: labels.categoryMeal,
          type: "meal",
        });
        break;
      case "rewards":
        tagItems.push({
          id: "category",
          label: labels.categoryRewards,
          type: "rewards",
        });
        break;
      case "expenses":
        tagItems.push({
          id: "category",
          label: labels.categoryExpenses,
          type: "expenses",
        });
        break;
      case "gyms":
        tagItems.push({
          id: "category",
          label: labels.categoryGyms,
          type: "gyms",
        });
        break;
    }

    if (hasCashback) {
      tagItems.push({
        id: "cashback",
        label: labels.cashback,
        type: "cashback",
      });
    }

    acceptedProducts.forEach((productId) => {
      let label = productId;
      let initials = productId.substring(0, 1).toUpperCase();

      if (productId === "flexone") {
        label = labels.flexone;
        initials = "F1";
      } else if (productId === "fitpass") {
        label = labels.fitpass;
        initials = "FP";
      } else if (productId === "up-expense") {
        label = labels.upExpense;
        initials = "EX";
      } else if (productId === "go-for-eat") {
        label = "go for EAT";
        initials = "EAT";
      } else if (productId === "cheque-dejeuner") {
        label = "Chèque Déjeuner";
        initials = "CD";
      } else if (productId === "up-meal") {
        label = labels.upMeal;
        initials = "M";
      } else if (productId === "up-gift") {
        label = labels.upGift;
        initials = "G";
      }

      logoItems.push({
        id: productId,
        label,
        initials,
        type: productId.replace(/\s+/g, "-"),
      });
    });

    return { tags: tagItems, productLogos: logoItems };
  }, [category, hasCashback, acceptedProducts, labels]);

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
            <div className={styles.badges}>
              {productLogos.length > 0 && (
                <div className={styles.productStack}>
                  {productLogos.map((logo) => (
                    <div
                      key={logo.id}
                      className={`${styles.productLogo} ${styles[logo.type]}`}
                      title={logo.label}
                    >
                      <span className={styles.productPlaceholder}>
                        {logo.initials}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {tags.length > 0 && (
                <div className={styles.networks}>
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`${styles.network} ${styles[tag.type]}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.controls}>
          <button type="button" onClick={onClose} className={styles.controlBtn}>
            <Icon name={ICONS.X} width={18} height={18} />
          </button>
        </div>
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
              className={`${styles.bioBody} ${
                !isBioExpanded && shouldShowToggle ? styles.truncated : ""
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
