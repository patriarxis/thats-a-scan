"use client";

import styles from "./QuickFilterChips.module.scss";

interface QuickFilterOption {
  id: string;
  label: string;
}

interface QuickFilterChipsProps {
  options: QuickFilterOption[];
  onToggle: (id: string) => void;
}

export const QuickFilterChips = ({
  options,
  onToggle,
}: QuickFilterChipsProps) => {
  return (
    <div className={styles.container}>
      {options.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={styles.chip}
          onClick={() => onToggle(cat.id)}
        >
          <span className={styles.label}>{cat.label}</span>
        </button>
      ))}
    </div>
  );
};

export const FilterChips = QuickFilterChips;
