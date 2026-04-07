"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./SearchBar.module.scss";

export type SearchSuggestion =
  | {
      type: "merchant";
      id: string;
      label: string;
      sublabel: string;
      merchantId: string;
      coordinates: [number, number];
    }
  | {
      type: "place";
      id: string;
      label: string;
      sublabel: string;
      center: [number, number];
    };

type SearchBarProps = {
  value: string;
  suggestions: SearchSuggestion[];
  loading: boolean;
  placeholder: string;
  searchAriaLabel: string;
  clearAriaLabel: string;
  loadingAriaLabel: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClear: () => void;
};

export function SearchBar({
  value,
  suggestions,
  loading,
  placeholder,
  searchAriaLabel,
  clearAriaLabel,
  loadingAriaLabel,
  onChange,
  onSelect,
  onClear
}: SearchBarProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = "locator-search-suggestions";
  const isOpen = suggestions.length > 0;
  const activeId = useMemo(
    () => (activeIndex >= 0 ? `search-opt-${activeIndex}` : undefined),
    [activeIndex]
  );

  return (
    <div className={styles.wrapper}>
      <label htmlFor="locator-search" className="sr-only">
        {searchAriaLabel}
      </label>
      <div className={styles.inputWrapper}>
        <Search
          className={styles.searchIcon}
          aria-hidden
        />
        <input
          id="locator-search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={(e) => {
            if (!isOpen) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
            }
            if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              onSelect(suggestions[activeIndex]);
              setActiveIndex(-1);
            }
            if (e.key === "Escape") {
              setActiveIndex(-1);
            }
          }}
          placeholder={placeholder}
          className={styles.input}
        />
        <div className={styles.controlsWrapper}>
          {loading && (
            <span
              className={styles.spinner}
              aria-label={loadingAriaLabel}
            />
          )}
          {value && (
            <button
              type="button"
              onClick={onClear}
              className={styles.clearBtn}
              aria-label={clearAriaLabel}
            >
              <X className={styles.clearIcon} />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className={styles.dropdown}
        >
          {suggestions.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                id={`search-opt-${index}`}
                key={item.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                  setActiveIndex(-1);
                }}
                className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
              >
                <p className={styles.optionLabel}>
                  {item.label}
                </p>
                <p className={styles.optionSublabel}>
                  {item.sublabel}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
