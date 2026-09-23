"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Backdrop } from "@/shared/ui/Backdrop/Backdrop";
import { Icon, IconButton } from "@/shared/ui";
import { ICONS } from "@/shared/icons";
import {
  formatFileSize,
  formatTextureAddress,
  getAssetDownloadOptions,
  getCategoryGroupLabel,
  getSelectedAssetDownloadOptions,
  getTextureAssets,
  getTextureDescription,
  getTextureDownloadOptions,
  getTextureSpecimenId,
  getTextureTitle,
  type TextureAsset,
  type TextureFeature,
} from "@/domain/textures";
import { buildTextureShareUrlFromFeature } from "@/domain/textures/share";
import { COPIED_FEEDBACK_DURATION_MS } from "@/config/map";
import { modalLabels } from "@/content/strings";
import { DownloadMenu } from "./DownloadMenu";
import styles from "./TextureAssetModal.module.scss";

type TextureAssetModalProps = {
  texture: TextureFeature | null;
  onClose: () => void;
};

const licenseLabel = (license: string): string => {
  switch (license) {
    case "cc-by":
      return modalLabels.licenseCcBy;
    case "commercial":
      return modalLabels.licenseCommercial;
    case "personal":
      return modalLabels.licensePersonal;
    default:
      return modalLabels.licenseAllRights;
  }
};

function formatDimensions(asset: TextureAsset): string | null {
  if (!asset.dimensions) return null;
  return `${asset.dimensions.width} × ${asset.dimensions.height}px`;
}

/**
 * `resolveMediaUrl` returns "" for an unpopulated relation and `next/image`
 * throws on an empty `src`, so render a placeholder block instead.
 */
function AssetImage({
  asset,
  className,
  sizes,
  priority,
}: {
  asset: TextureAsset;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!asset.previewUrl) {
    return (
      <div className={styles.previewPlaceholder} aria-hidden>
        <span>{asset.format.toUpperCase()}</span>
      </div>
    );
  }

  return (
    <Image
      src={asset.previewUrl}
      alt={asset.label}
      fill
      className={className}
      unoptimized
      sizes={sizes}
      priority={priority}
    />
  );
}

export function TextureAssetModal({ texture, onClose }: TextureAssetModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  /**
   * The last texture that was open. The parent clears `texture` the instant the
   * modal closes, so without this there is nothing left to render during the
   * exit animation and the modal vanishes rather than fading.
   */
  const [heldTexture, setHeldTexture] = useState<TextureFeature | null>(texture);

  // Adjusting state during render rather than in an effect: React re-renders
  // immediately, so the new texture's first frame already shows its own asset.
  if (texture && texture !== heldTexture) {
    setHeldTexture(texture);
    setSelectedAssetId(null);
  }

  const isOpen = texture !== null;
  const displayTexture = texture ?? heldTexture;

  const assets = displayTexture ? getTextureAssets(displayTexture) : [];
  const selectedAsset =
    assets.find((a) => a.id === selectedAssetId) ?? assets[0] ?? null;
  const allDownloadOptions = displayTexture ? getTextureDownloadOptions(displayTexture) : [];
  const selectedDownloadOptions =
    displayTexture && selectedAsset
      ? getSelectedAssetDownloadOptions(displayTexture, selectedAsset)
      : [];

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleShare = useCallback(async () => {
    if (!displayTexture) return;
    try {
      await navigator.clipboard.writeText(buildTextureShareUrlFromFeature(displayTexture));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      /* clipboard unavailable */
    }
  }, [displayTexture]);

  if (!displayTexture || !selectedAsset) return null;

  const title = getTextureTitle(displayTexture);
  const description = getTextureDescription(displayTexture);
  const surfaceType = getCategoryGroupLabel(displayTexture.properties.category);
  const specimenId = getTextureSpecimenId(displayTexture);
  const locationLine = formatTextureAddress(displayTexture) || modalLabels.noAddress;
  const assetDimensions = formatDimensions(selectedAsset);

  return (
    <Backdrop
      isOpen={isOpen}
      tone="strong"
      onClick={onClose}
      contentClassName={styles.backdropContent}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="texture-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.headerArchiveRow}>
              <span className={styles.specimenStamp}>{specimenId}</span>
              <span className={styles.fieldLogTag}>{modalLabels.fieldSpecimen}</span>
            </div>
            <p className={styles.eyebrow}>{surfaceType}</p>
            <h2 id="texture-modal-title" className={styles.title}>
              {title}
            </h2>
            <p className={styles.subtitle}>{locationLine}</p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.shareBtn} onClick={handleShare}>
              <Icon name={ICONS.SHARE_NETWORK} aria-hidden />
              {copied ? modalLabels.copied : modalLabels.share}
            </button>
            <IconButton icon={ICONS.X} aria-label={modalLabels.close} onClick={onClose} />
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.previewPanel}>
            <div className={styles.previewFrame}>
              <div className={styles.scannedSheet}>
                <div className={styles.previewCanvas}>
                  <div className={styles.previewImageWrap}>
                    <AssetImage
                      asset={selectedAsset}
                      className={styles.previewImage}
                      sizes="(max-width: 768px) 100vw, 640px"
                      priority
                    />
                  </div>
                </div>
                <span className={styles.scanLabel}>{modalLabels.scannedSample}</span>
              </div>
            </div>
            <div className={styles.previewMeta}>
              <h3 className={styles.assetTitle}>{selectedAsset.label}</h3>
              {selectedAsset.description && (
                <p className={styles.assetDescription}>{selectedAsset.description}</p>
              )}
              <dl className={styles.assetStats}>
                <div className={styles.assetStat}>
                  <dt>{modalLabels.format}</dt>
                  <dd>{selectedAsset.format.toUpperCase()}</dd>
                </div>
                <div className={styles.assetStat}>
                  <dt>{modalLabels.fileSize}</dt>
                  <dd>{formatFileSize(selectedAsset.sizeBytes)}</dd>
                </div>
                {assetDimensions && (
                  <div className={styles.assetStat}>
                    <dt>{modalLabels.dimensions}</dt>
                    <dd>{assetDimensions}</dd>
                  </div>
                )}
                {displayTexture.properties.dpi && (
                  <div className={styles.assetStat}>
                    <dt>{modalLabels.dpi}</dt>
                    <dd>{displayTexture.properties.dpi}</dd>
                  </div>
                )}
              </dl>
              <div className={styles.previewActions}>
                <DownloadMenu options={selectedDownloadOptions} variant="primary" />
              </div>
            </div>
          </div>

          <aside className={styles.assetsPanel}>
            <div className={styles.assetsHeadingRow}>
              <h3 className={styles.assetsHeading}>
                {modalLabels.assets}
                <span className={styles.assetCount}>{assets.length}</span>
              </h3>
              <DownloadMenu
                options={allDownloadOptions}
                variant="compact"
                align="end"
                ariaLabel={`${modalLabels.downloadAll} (${assets.length})`}
              />
            </div>
            <div className={styles.assetGrid}>
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  textureId={displayTexture.properties.id}
                  isSelected={asset.id === selectedAsset.id}
                  onSelect={() => setSelectedAssetId(asset.id)}
                />
              ))}
            </div>

            {description && (
              <div className={styles.infoBlock}>
                <h4 className={styles.infoLabel}>{modalLabels.fieldNotes}</h4>
                <p className={styles.infoText}>{description}</p>
              </div>
            )}

            {displayTexture.properties.locationNote && (
              <div className={styles.fieldNoteBlock}>
                <h4 className={styles.fieldNoteLabel}>{modalLabels.locationNote}</h4>
                <p className={styles.fieldNoteText}>{displayTexture.properties.locationNote}</p>
              </div>
            )}

            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt>{modalLabels.license}</dt>
                <dd>{licenseLabel(displayTexture.properties.license)}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>{modalLabels.scannedBy}</dt>
                <dd>{displayTexture.properties.scannedBy}</dd>
              </div>
            </dl>

            {displayTexture.properties.tags.length > 0 && (
              <div className={styles.tagList}>
                {displayTexture.properties.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Backdrop>
  );
}

function AssetCard({
  asset,
  textureId,
  isSelected,
  onSelect,
}: {
  asset: TextureAsset;
  textureId: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ""}`}
    >
      <button type="button" className={styles.assetSelectBtn} onClick={onSelect}>
        <div className={styles.assetThumb}>
          <AssetImage asset={asset} className={styles.assetThumbImg} sizes="120px" />
        </div>
        <div className={styles.assetCardBody}>
          <span className={styles.assetCardLabel}>{asset.label}</span>
          <span className={styles.assetCardMeta}>
            {asset.format.toUpperCase()} · {formatFileSize(asset.sizeBytes)}
          </span>
        </div>
      </button>
      <DownloadMenu
        options={getAssetDownloadOptions(asset, textureId)}
        variant="icon"
        align="end"
        ariaLabel={`${modalLabels.download} ${asset.label}`}
      />
    </article>
  );
}
