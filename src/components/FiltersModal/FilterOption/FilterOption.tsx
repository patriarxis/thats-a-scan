"use client";

import styles from "./FilterOption.module.scss";

type FilterOptionProps = {
  label: string;
  isSelected: boolean;
  onClick: () => void;
};

export const FilterOption = ({ label, isSelected, onClick }: FilterOptionProps) => {
  return (
    <button
      type="button"
      className={`${styles.option} ${isSelected ? styles.optionActive : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
