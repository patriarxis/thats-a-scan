import type { Ref } from "react";
import { Icon } from "@/components/ui";
import { ICONS } from "@/enums";
import styles from "./SearchResultsPanel.module.scss";
import { HighlightedText } from "@/components/ui/HighlightedText/HighlightedText";
import type { SearchSuggestion } from "@/components/SearchBar/SearchBar";
import {
  getMerchantCategoryIcon,
  type MerchantCategoryId,
} from "@/lib/merchantCategorization";

type SearchResultsPanelProps = {
  id: string;
  listRef?: Ref<HTMLUListElement>;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  query: string;
  categorySectionLabel: string;
  placeSectionLabel: string;
  keyboardHintNavigate: string;
  keyboardHintSelect: string;
  keyboardHintClose: string;
  mobileFullscreen?: boolean;
  mobileClosing?: boolean;
  searchMapResultCount?: number | null;
  searchMapLoading?: boolean;
  searchResultsOnMapLabel?: string;
  onSelect: (item: SearchSuggestion) => void;
  onHover: (index: number) => void;
};

export const SearchResultsPanel = ({
  id,
  listRef,
  suggestions,
  activeIndex,
  query,
  categorySectionLabel,
  placeSectionLabel,
  keyboardHintNavigate,
  keyboardHintSelect,
  keyboardHintClose,
  mobileFullscreen = false,
  mobileClosing = false,
  searchMapResultCount = null,
  searchMapLoading = false,
  searchResultsOnMapLabel,
  onSelect,
  onHover,
}: SearchResultsPanelProps) => {
  const categoryEntries = suggestions
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.type === "category");
  const merchantEntries = suggestions
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.type === "merchant");

  const renderOption = (item: SearchSuggestion, index: number) => {
    const isActive = index === activeIndex;
    const categoryIcon =
      item.icon ??
      (item.type === "category" && item.categoryId
        ? getMerchantCategoryIcon(item.categoryId as MerchantCategoryId)
        : ICONS.STOREFRONT);

    return (
      <li
        id={`search-opt-${index}`}
        key={item.id}
        role="option"
        aria-selected={isActive}
        onMouseEnter={() => onHover(index)}
        onPointerDown={(event) => {
          event.preventDefault();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(item);
        }}
        className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
      >
        <div className={styles.optionIcon}>
          <Icon name={categoryIcon} className={styles.optionIconGlyph} />
        </div>
        <div className={styles.optionBody}>
          <p className={styles.optionLabel}>
            <HighlightedText text={item.label} query={query} />
          </p>
          <p className={styles.optionSublabel}>
            <HighlightedText text={item.sublabel} query={query} />
          </p>
        </div>
      </li>
    );
  };

  return (
    <div
      className={`${styles.dropdown} ${mobileFullscreen ? styles.dropdownFullscreenMobile : ""} ${mobileClosing ? styles.dropdownClosingMobile : ""}`}
    >
      <ul id={id} ref={listRef} role="listbox" className={styles.optionsList}>
        {categoryEntries.length > 0 && (
          <li className={styles.sectionLabel} aria-hidden>
            <Icon name={ICONS.TAG} className={styles.sectionLabelIcon} />
            <span>{categorySectionLabel}</span>
          </li>
        )}
        {categoryEntries.map(({ item, index }) => renderOption(item, index))}
        {categoryEntries.length > 0 && merchantEntries.length > 0 && (
          <li className={styles.sectionDivider} aria-hidden />
        )}
        {merchantEntries.length > 0 && (
          <li className={styles.sectionLabel} aria-hidden>
            <Icon name={ICONS.STOREFRONT} className={styles.sectionLabelIcon} />
            <span>{placeSectionLabel}</span>
          </li>
        )}
        {merchantEntries.map(({ item, index }) => renderOption(item, index))}
      </ul>

      {(searchMapLoading || (searchMapResultCount !== null && searchMapResultCount > 0)) && (
        <p className={styles.mapResultsFooter} aria-live="polite">
          {searchMapLoading
            ? "…"
            : searchResultsOnMapLabel?.replace(
                "{{count}}",
                String(searchMapResultCount ?? 0),
              )}
        </p>
      )}

      <div className={styles.keyboardHints} aria-hidden>
        <span className={styles.keyboardHintItem}>
          <span className={styles.keyIconPair}>
            <span className={styles.keyIcon}>
              <Icon name={ICONS.ARROW_UP} />
            </span>
            <span className={styles.keyIcon}>
              <Icon name={ICONS.ARROW_DOWN} />
            </span>
          </span>
          <span>{keyboardHintNavigate}</span>
        </span>
        <span className={styles.keyboardHintItem}>
          <span className={styles.keyText}>Enter</span>
          <span>{keyboardHintSelect}</span>
        </span>
        <span className={styles.keyboardHintItem}>
          <span className={styles.keyText}>Esc</span>
          <span>{keyboardHintClose}</span>
        </span>
      </div>
    </div>
  );
};
