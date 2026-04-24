"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";
import { SearchResultsPanel } from "@/components/SearchPanel/SearchResultsPanel";
import { FiltersModal, type FiltersModalProps } from "@/components/FiltersModal/FiltersModal";
import { Backdrop } from "@/components/ui/Backdrop/Backdrop";
import { Icon, IconButton } from "@/components/ui";
import { ICONS } from "@/enums";
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
  onCloseSearch?: () => void;
  isFiltersOpen?: boolean;
  filtersPanelProps?: Omit<FiltersModalProps, "isOpen">;
  showLocaleSwitcher?: boolean;
  localeSwitcherAriaLabel?: string;
  onOpenLocalePanel?: () => void;
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
  onCloseSearch,
  isFiltersOpen = false,
  filtersPanelProps,
  showLocaleSwitcher = false,
  localeSwitcherAriaLabel = "Change language",
  onOpenLocalePanel,
}: SearchBarProps) => {
  const MOBILE_SEARCH_CLOSE_ANIMATION_MS = 100;
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
    if (!isFocusShellActive && !isFiltersOpen) {
      setActiveIndex(-1);
      return;
    }
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
    closeFocusShellDirect(() => setActiveIndex(-1));
  }, [closeActiveSignal, closeFocusShellDirect, isFiltersOpen, isFocusShellActive]);

  const handleSelect = (item: SearchSuggestion) => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
    onSelect(item);
    closeFocusShell(() => setActiveIndex(-1));
  };

  const handleMobileBackButton = () => {
    if (onCloseSearch) {
      onCloseSearch();
      return;
    }
    closeSearchToDefault();
  };

  const handleWrapperClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isSearchUiActive && !isClosing) return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    handleMobileBackButton();
  };

  return (
    <>
      <Backdrop
        isOpen={isSearchUiActive || isClosing}
        onClick={handleMobileBackButton}
        className={styles.backdrop}
        usePortal={false}
        exitDurationMs={MOBILE_SEARCH_CLOSE_ANIMATION_MS}
      />
      <div
        className={`${styles.wrapper} ${isSearchUiActive ? styles.wrapperFocused : ""} ${isClosing ? styles.wrapperClosing : ""}`}
        style={wrapperStyle}
        role="search"
        onClick={handleWrapperClick}
      >
        <div className={styles.inputWrapper}>
        <div className={styles.searchIconWrapper}>
          <IconButton
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleMobileBackButton}
            icon={ICONS.ARROW_LEFT}
            className={styles.mobileBackBtn}
            aria-label={clearAriaLabel}
          />
          <Icon name={ICONS.MAGNIFYING_GLASS} className={styles.searchIcon} aria-hidden />
          <Icon name={ICONS.INFINITY_SEARCH} className={styles.mobileInfinityIcon} />
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
            <IconButton
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClear}
              icon={ICONS.X}
              className={styles.clearBtn}
              aria-label={clearAriaLabel}
            />
          )}
          <IconButton
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
            icon={ICONS.FADERS}
            className={styles.filtersBtn}
            aria-label={openFiltersAriaLabel}
          >
            {filterActiveCount > 0 && (
              <span className={styles.filtersBadge}>{filterActiveCount}</span>
            )}
          </IconButton>
          {showLocaleSwitcher && onOpenLocalePanel && (
            <div className={styles.localeControl}>
              <span className={styles.localeControlDivider} aria-hidden />
              <IconButton
                onMouseDown={(event) => event.preventDefault()}
                onClick={onOpenLocalePanel}
                icon={ICONS.GLOBE}
                className={styles.localeMenuBtn}
                aria-label={localeSwitcherAriaLabel}
              />
            </div>
          )}
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
    </>
  );
};
