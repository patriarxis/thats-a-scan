"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/shared/ui";
import { ICONS } from "@/shared/icons";
import {
  formatDownloadOptionMeta,
  triggerDownloadAll,
  triggerFileDownload,
  type DownloadOption,
} from "@/domain/textures/download";
import { modalLabels } from "@/content/strings";
import styles from "./DownloadMenu.module.scss";

type DownloadMenuProps = {
  options: DownloadOption[];
  variant?: "primary" | "compact" | "icon";
  align?: "start" | "end";
  ariaLabel?: string;
};

export function DownloadMenu({
  options,
  variant = "primary",
  align = "start",
  ariaLabel = modalLabels.download,
}: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  if (options.length === 0) return null;

  const showDownloadAll = options.length > 1;

  const handleDownloadAll = () => {
    void triggerDownloadAll(options);
    close();
  };

  const handleOption = (url: string) => {
    triggerFileDownload(url);
    close();
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${styles[`root_${variant}`]} ${open ? styles.rootOpen : ""}`}
    >
      <button
        type="button"
        className={`${styles.trigger} ${styles[`trigger_${variant}`]}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {variant === "icon" ? (
          <Icon name={ICONS.ARROW_DOWN} aria-hidden className={styles.triggerIcon} />
        ) : (
          <>
            <span>{variant === "compact" ? modalLabels.downloadAll : modalLabels.download}</span>
            <Icon name={ICONS.ARROW_DOWN} aria-hidden className={styles.chevron} />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`${styles.menu} ${styles[`menu_${align}`]}`}
        >
          {showDownloadAll && (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.downloadAllItem}
                onClick={handleDownloadAll}
              >
                <Icon name={ICONS.ARROW_DOWN} aria-hidden />
                <span className={styles.downloadAllLabel}>{modalLabels.downloadAll}</span>
                <span className={styles.downloadAllCount}>{options.length}</span>
              </button>
              <div className={styles.divider} role="separator" />
            </>
          )}
          <ul className={styles.optionList}>
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.optionItem}
                  onClick={() => handleOption(option.url)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionMeta}>
                    {formatDownloadOptionMeta(option)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
