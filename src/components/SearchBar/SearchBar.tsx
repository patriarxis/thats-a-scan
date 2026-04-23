"use client";

import { ArrowLeft, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";
import { SearchResultsPanel } from "@/components/SearchPanel/SearchResultsPanel";
import { FiltersModal, type FiltersModalProps } from "@/components/FiltersModal/FiltersModal";
import styles from "./SearchBar.module.scss";

import { useSearchFocusShell } from "./useSearchFocusShell";

export type SearchSuggestion = {
  type: "merchant" | "category";
  id: string;
  label: string;
  sublabel: string;
  merchantId?: string;
  coordinates?: [number, number];
  categoryId?: string;
};

type SearchBarProps = {
  value: string;
  suggestions: SearchSuggestion[];
  suppressSuggestions?: boolean;
  placeholder: string;
  searchAriaLabel: string;
  clearAriaLabel: string;
  openFiltersAriaLabel: string;
  filterActiveCount?: number;
  categorySectionLabel: string;
  placeSectionLabel: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onFocusInput?: () => void;
  focusInputSignal?: number;
  closeActiveSignal?: number;
  isFiltersOpen?: boolean;
  filtersPanelProps?: Omit<FiltersModalProps, "isOpen">;
};

export const SearchBar = ({
  value,
  suggestions,
  suppressSuggestions = false,
  placeholder,
  searchAriaLabel,
  clearAriaLabel,
  openFiltersAriaLabel,
  filterActiveCount = 0,
  categorySectionLabel,
  placeSectionLabel,
  onChange,
  onSelect,
  onClear,
  onOpenFilters,
  onFocusInput,
  focusInputSignal,
  closeActiveSignal,
  isFiltersOpen = false,
  filtersPanelProps,
}: SearchBarProps) => {
  const MOBILE_SEARCH_CLOSE_ANIMATION_MS = 180;
  const MOBILE_ONLY_MEDIA_QUERY = "(max-width: 639px)";
  const [activeIndex, setActiveIndex] = useState(-1);
  const prevFocusInputSignalRef = useRef<number | undefined>(focusInputSignal);
  const prevCloseActiveSignalRef = useRef<number | undefined>(closeActiveSignal);
  const skipBlurCloseRef = useRef(false);
  const closeSearchToDefaultRef = useRef<() => void>(() => {});
  const closeFiltersToSearchRef = useRef<() => boolean>(() => false);
  const listboxId = useId();
  const handleMobileBack = useCallback(() => {
    if (isFiltersOpen) {
      return closeFiltersToSearchRef.current();
    }
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement &&
      activeElement.id === "locator-search"
    ) {
      activeElement.blur();
      return true;
    }
    closeSearchToDefaultRef.current();
    return true;
  }, [isFiltersOpen]);
  const {
    inputRef,
    isFocused,
    isClosing,
    isFocusShellActive,
    wrapperStyle,
    closeFocusShell,
    closeFocusShellDirect,
    handleInputFocus,
  } = useSearchFocusShell({
    mobileMediaQuery: MOBILE_ONLY_MEDIA_QUERY,
    closeAnimationMs: MOBILE_SEARCH_CLOSE_ANIMATION_MS,
    onMobileBack: handleMobileBack,
  });
  const closeSearchToDefault = useCallback(() => {
    closeFocusShellDirect(() => setActiveIndex(-1));
  }, [closeFocusShellDirect]);

  const closeFiltersToSearch = useCallback(() => {
    if (!filtersPanelProps?.onClose) return false;
    filtersPanelProps.onClose();
    window.setTimeout(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      handleInputFocus();
    }, 0);
    return true;
  }, [filtersPanelProps, handleInputFocus, inputRef]);
  useEffect(() => {
    closeSearchToDefaultRef.current = closeSearchToDefault;
    closeFiltersToSearchRef.current = closeFiltersToSearch;
  }, [closeFiltersToSearch, closeSearchToDefault]);
  const isSearchUiActive = isFocusShellActive || isFiltersOpen;
  const isOpen =
    isSearchUiActive && !isFiltersOpen && !suppressSuggestions && suggestions.length > 0;
  const { isMounted: showSuggestionsPanel, isClosing: isSuggestionsPanelClosing } =
    useAnimatedPresence(isOpen, 180);
  const activeId = useMemo(
    () => (activeIndex >= 0 ? `search-opt-${activeIndex}` : undefined),
    [activeIndex],
  );
  const selectedSuggestion =
    activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen]);

  useEffect(() => {
    if (typeof focusInputSignal !== "number") return;
    if (focusInputSignal === prevFocusInputSignalRef.current) return;
    prevFocusInputSignalRef.current = focusInputSignal;
    if (!inputRef.current) return;
    inputRef.current.focus();
    handleInputFocus();
  }, [focusInputSignal, handleInputFocus, inputRef]);

  useEffect(() => {
    if (typeof closeActiveSignal !== "number") return;
    if (closeActiveSignal === prevCloseActiveSignalRef.current) return;
    prevCloseActiveSignalRef.current = closeActiveSignal;
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
    closeFocusShellDirect(() => setActiveIndex(-1));
  }, [closeActiveSignal, closeFocusShellDirect]);

  const handleSelect = (item: SearchSuggestion) => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
    onSelect(item);
    closeFocusShell(() => setActiveIndex(-1));
  };

  const handleMobileBackButton = () => {
    if (isFiltersOpen) {
      closeFiltersToSearch();
      return;
    }
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
      return;
    }
    closeSearchToDefault();
  };

  return (
    <div
      className={`${styles.wrapper} ${isSearchUiActive ? styles.wrapperFocused : ""} ${isClosing ? styles.wrapperClosing : ""}`}
      style={wrapperStyle}
      role="search"
    >
      <div className={styles.inputWrapper}>
        <div className={styles.searchIconWrapper}>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleMobileBackButton}
            className={styles.mobileBackBtn}
            aria-label={clearAriaLabel}
          >
            <ArrowLeft className={styles.mobileBackIcon} />
          </button>
          <Search className={styles.searchIcon} aria-hidden />
        </div>
        <input
          ref={inputRef}
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
          onPointerDown={() => {
            onFocusInput?.();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            handleInputFocus(onFocusInput);
          }}
          onBlur={() => {
            if (skipBlurCloseRef.current || isFiltersOpen) {
              skipBlurCloseRef.current = false;
              return;
            }
            window.setTimeout(() => {
              closeFocusShell(() => setActiveIndex(-1));
            }, 120);
          }}
          onKeyDown={(e) => {
            if (!isOpen) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) =>
                Math.min(prev + 1, suggestions.length - 1),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
            }
            if (e.key === "Enter" && selectedSuggestion) {
              e.preventDefault();
              handleSelect(selectedSuggestion);
            }
            if (e.key === "Escape") {
              closeFocusShell(() => setActiveIndex(-1));
            }
          }}
          placeholder={placeholder}
          className={styles.input}
        />
        <div className={styles.controlsWrapper}>
          {value && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClear}
              className={styles.clearBtn}
              aria-label={clearAriaLabel}
            >
              <X className={styles.clearIcon} />
            </button>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              skipBlurCloseRef.current = true;
              handleInputFocus(onFocusInput);
              if (inputRef.current && document.activeElement === inputRef.current) {
                inputRef.current.blur();
              }
              onOpenFilters();
              setActiveIndex(-1);
            }}
            className={styles.filtersBtn}
            aria-label={openFiltersAriaLabel}
          >
            <SlidersHorizontal className={styles.filtersIcon} />
            {filterActiveCount > 0 && (
              <span className={styles.filtersBadge}>{filterActiveCount}</span>
            )}
          </button>
        </div>
      </div>

      {isFiltersOpen && filtersPanelProps ? (
        <FiltersModal isOpen={isFiltersOpen} {...filtersPanelProps} />
      ) : (
        showSuggestionsPanel && (
        <SearchResultsPanel
          id={listboxId}
          suggestions={suggestions}
          activeIndex={activeIndex}
          query={value}
          categorySectionLabel={categorySectionLabel}
          placeSectionLabel={placeSectionLabel}
          mobileFullscreen={isSearchUiActive}
          mobileClosing={isClosing || isSuggestionsPanelClosing}
          onSelect={handleSelect}
          onHover={setActiveIndex}
        />
        )
      )}
    </div>
  );
};
