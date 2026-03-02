"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

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
    <div className="relative w-full max-w-3xl">
      <label htmlFor="locator-search" className="sr-only">
        {searchAriaLabel}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
          className="h-14 w-full rounded-2xl border border-white/45 bg-white/80 pl-12 pr-24 text-base text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-md outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-200/60 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:focus:ring-orange-500/35"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {loading && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent"
              aria-label={loadingAriaLabel}
            />
          )}
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={clearAriaLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[80] mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-white/60 bg-white/92 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
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
                className={`cursor-pointer rounded-xl px-3 py-2 transition ${
                  isActive
                    ? "bg-orange-50 dark:bg-orange-500/15"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
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
