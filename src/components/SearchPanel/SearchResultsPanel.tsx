import { Store, Tags } from "lucide-react";
import styles from "./SearchResultsPanel.module.scss";
import { HighlightedText } from "@/components/ui/HighlightedText/HighlightedText";
import type { SearchSuggestion } from "@/components/SearchBar/SearchBar";

type SearchResultsPanelProps = {
  id: string;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  query: string;
  categorySectionLabel: string;
  placeSectionLabel: string;
  mobileFullscreen?: boolean;
  mobileClosing?: boolean;
  onSelect: (item: SearchSuggestion) => void;
  onHover: (index: number) => void;
};

export const SearchResultsPanel = ({
  id,
  suggestions,
  activeIndex,
  query,
  categorySectionLabel,
  placeSectionLabel,
  mobileFullscreen = false,
  mobileClosing = false,
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
    return (
      <li
        id={`search-opt-${index}`}
        key={item.id}
        role="option"
        aria-selected={isActive}
        onMouseEnter={() => onHover(index)}
        onMouseDown={(e) => {
          e.preventDefault();
          onSelect(item);
        }}
        className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
      >
        <div className={styles.optionIcon}>
          {item.type === "category" ? <Tags size={14} /> : <Store size={14} />}
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
    <ul
      id={id}
      role="listbox"
      className={`${styles.dropdown} ${mobileFullscreen ? styles.dropdownFullscreenMobile : ""} ${mobileClosing ? styles.dropdownClosingMobile : ""}`}
    >
      {categoryEntries.length > 0 && (
        <li className={styles.sectionLabel} aria-hidden>
          <Tags size={12} />
          <span>{categorySectionLabel}</span>
        </li>
      )}
      {categoryEntries.map(({ item, index }) => renderOption(item, index))}
      {categoryEntries.length > 0 && merchantEntries.length > 0 && (
        <li className={styles.sectionDivider} aria-hidden />
      )}
      {merchantEntries.length > 0 && (
        <li className={styles.sectionLabel} aria-hidden>
          <Store size={12} />
          <span>{placeSectionLabel}</span>
        </li>
      )}
      {merchantEntries.map(({ item, index }) => renderOption(item, index))}
    </ul>
  );
};
