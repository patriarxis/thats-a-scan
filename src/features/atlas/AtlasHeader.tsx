"use client";

import { modalLabels } from "@/content/strings";
import styles from "./AtlasHeader.module.scss";

export function AtlasHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.brandTag}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            ◈
          </span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Textures Atlas</span>
            <span className={styles.brandSubtitle}>{modalLabels.atlasFieldCatalog}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
