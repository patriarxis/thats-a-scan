"use client";

import { ICONS } from "@/enums";
import { Icon } from "@/components/ui";
import styles from "./QuickFilterChips.module.scss";

interface QuickFilterOption {
  id: string;
  label: string;
  icon?: ICONS;
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
          {cat.icon && <Icon name={cat.icon} className={styles.icon} aria-hidden />}
          <span className={styles.label}>{cat.label}</span>
        </button>
      ))}
    </div>
  );
};
