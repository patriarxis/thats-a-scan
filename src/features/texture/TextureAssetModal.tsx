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

export function TextureAssetModal({ texture, onClose }: TextureAssetModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const assets = texture ? getTextureAssets(texture) : [];
  const selectedAsset =
    assets.find((a) => a.id === selectedAssetId) ?? assets[0] ?? null;
  const allDownloadOptions = texture ? getTextureDownloadOptions(texture) : [];
  const selectedDownloadOptions =
    texture && selectedAsset
      ? getSelectedAssetDownloadOptions(texture, selectedAsset)
      : [];

  useEffect(() => {
    if (!texture) {
      setSelectedAssetId(null);
      return;
    }
    const nextAssets = getTextureAssets(texture);
    setSelectedAssetId(nextAssets[0]?.id ?? null);
  }, [texture]);

  useEffect(() => {
    if (!texture) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, texture]);

  const handleShare = useCallback(async () => {
    if (!texture) return;
    try {
      await navigator.clipboard.writeText(buildTextureShareUrlFromFeature(texture));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION_MS);
    } catch {
      /* clipboard unavailable */
    }
  }, [texture]);

  if (!texture || !selectedAsset) return null;

  const title = getTextureTitle(texture);
  const description = getTextureDescription(texture);
  const surfaceType = getCategoryGroupLabel(texture.properties.category);
  const specimenId = getTextureSpecimenId(texture);
  const locationLine = formatTextureAddress(texture) || modalLabels.noAddress;
  const assetDimensions = formatDimensions(selectedAsset);

  return (
    <Backdrop isOpen tone="strong" onClick={onClose} contentClassName={styles.backdropContent}>
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
                    <Image
                      src={selectedAsset.previewUrl}
                      alt={selectedAsset.label}
                      fill
                      className={styles.previewImage}
                      unoptimized
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
                {texture.properties.dpi && (
                  <div className={styles.assetStat}>
                    <dt>{modalLabels.dpi}</dt>
                    <dd>{texture.properties.dpi}</dd>
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

            {texture.properties.locationNote && (
              <div className={styles.fieldNoteBlock}>
                <h4 className={styles.fieldNoteLabel}>{modalLabels.locationNote}</h4>
                <p className={styles.fieldNoteText}>{texture.properties.locationNote}</p>
              </div>
            )}

            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt>{modalLabels.license}</dt>
                <dd>{licenseLabel(texture.properties.license)}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>{modalLabels.scannedBy}</dt>
                <dd>{texture.properties.scannedBy}</dd>
              </div>
            </dl>

            {texture.properties.tags.length > 0 && (
              <div className={styles.tagList}>
                {texture.properties.tags.map((tag) => (
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
  isSelected,
  onSelect,
}: {
  asset: TextureAsset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ""}`}
    >
      <button type="button" className={styles.assetSelectBtn} onClick={onSelect}>
        <div className={styles.assetThumb}>
          <Image
            src={asset.previewUrl}
            alt=""
            fill
            className={styles.assetThumbImg}
            unoptimized
            sizes="120px"
          />
        </div>
        <div className={styles.assetCardBody}>
          <span className={styles.assetCardLabel}>{asset.label}</span>
          <span className={styles.assetCardMeta}>
            {asset.format.toUpperCase()} · {formatFileSize(asset.sizeBytes)}
          </span>
        </div>
      </button>
      <DownloadMenu
        options={getAssetDownloadOptions(asset)}
        variant="icon"
        align="end"
        ariaLabel={`${modalLabels.download} ${asset.label}`}
      />
    </article>
  );
}
