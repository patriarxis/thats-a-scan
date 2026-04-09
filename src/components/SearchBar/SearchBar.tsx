"use client";

import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
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

export const SearchBar = ({
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
}: SearchBarProps) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const listboxId = useId();
  const isOpen = isFocused && suggestions.length > 0;
  const activeId = useMemo(
    () => (activeIndex >= 0 ? `search-opt-${activeIndex}` : undefined),
    [activeIndex],
  );
  const selectedSuggestion =
    activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen]);

  return (
    <form
      className={styles.wrapper}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selectedSuggestion) return;
        onSelect(selectedSuggestion);
        setActiveIndex(-1);
        setIsFocused(false);
      }}
    >
      <div className={styles.inputWrapper}>
        <Search
          className={styles.searchIcon}
          aria-hidden
        />
        <input
          id="locator-search"
          role="combobox"
          aria-label={searchAriaLabel}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false);
              setActiveIndex(-1);
            }, 120);
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
            if (e.key === "Enter" && selectedSuggestion) {
              e.preventDefault();
              onSelect(selectedSuggestion);
              setActiveIndex(-1);
              setIsFocused(false);
            }
            if (e.key === "Escape") {
              setActiveIndex(-1);
              setIsFocused(false);
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
          <button
            type="submit"
            className={styles.submitBtn}
            aria-label={searchAriaLabel}
          >
            <ArrowRight className={styles.submitIcon} />
          </button>
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
                  setIsFocused(false);
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
    </form>
  );
};
