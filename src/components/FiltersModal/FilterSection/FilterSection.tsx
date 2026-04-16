"use client";

import styles from "./FilterSection.module.scss";

type FilterSectionProps = {
  title: string;
  children: React.ReactNode;
};

export const FilterSection = ({ title, children }: FilterSectionProps) => {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      <div className={styles.optionGrid}>
        {children}
      </div>
    </div>
  );
};
