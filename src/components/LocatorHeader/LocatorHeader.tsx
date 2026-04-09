"use client";

import Image from "next/image";
import { LOCALE } from "@/lib";
import styles from "./LocatorHeader.module.scss";

type LocatorHeaderProps = {
  locale: LOCALE;
  onChangeLocale: (locale: LOCALE) => void;
};

export const LocatorHeader = ({ locale, onChangeLocale }: LocatorHeaderProps) => {
  return (
    <header className={styles.header}>
      <a
        href="https://uphellas.gr"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logoLink}
      >
        <Image
          className={styles.logo}
          src="/up-hellas-logo.svg"
          alt="Up Hellas"
          width={82}
          height={40}
          priority
        />
      </a>

      <div className={styles.localeToggle}>
        <button
          type="button"
          onClick={() => onChangeLocale(LOCALE.EL)}
          className={`p-xs ${styles.localeBtn} ${locale === LOCALE.EL ? styles.localeBtnActive : ""}`}
        >
          ΕΛ
        </button>
        <button
          type="button"
          onClick={() => onChangeLocale(LOCALE.EN)}
          className={`p-xs ${styles.localeBtn} ${locale === LOCALE.EN ? styles.localeBtnActive : ""}`}
        >
          EN
        </button>
      </div>
    </header>
  );
};
