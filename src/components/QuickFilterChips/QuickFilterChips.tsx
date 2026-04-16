"use client";

import { Utensils, Gift, Wallet, Dumbbell } from "lucide-react";
import type { CategoryId } from "@/types";
import styles from "./QuickFilterChips.module.scss";

interface Category {
  id: CategoryId;
  label: string;
  icon: React.ReactNode;
}

interface QuickFilterChipsProps {
  selectedIds: CategoryId[];
  onToggle: (id: CategoryId) => void;
  labels: {
    meal: string;
    rewards: string;
    expenses: string;
    gyms: string;
  };
}

export const QuickFilterChips = ({
  selectedIds,
  onToggle,
  labels,
}: QuickFilterChipsProps) => {
  const categories: Category[] = [
    {
      id: "meal",
      label: labels.meal,
      icon: <Utensils size={14} />,
    },
    {
      id: "rewards",
      label: labels.rewards,
      icon: <Gift size={14} />,
    },
    {
      id: "expenses",
      label: labels.expenses,
      icon: <Wallet size={14} />,
    },
    {
      id: "gyms",
      label: labels.gyms,
      icon: <Dumbbell size={14} />,
    },
  ];

  return (
    <div className={styles.container}>
      {categories.map((cat) => {
        const isActive = selectedIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
            onClick={() => onToggle(cat.id)}
          >
            <span className={styles.icon}>{cat.icon}</span>
            <span className={styles.label}>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const FilterChips = QuickFilterChips;
