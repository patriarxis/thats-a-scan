import styles from "./SearchDropdown.module.scss";
import { HighlightedText } from "../HighlightedText/HighlightedText";
import type { SearchSuggestion } from "../SearchBar";

type SearchDropdownProps = {
  id: string;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  query: string;
  onSelect: (item: SearchSuggestion) => void;
  onHover: (index: number) => void;
};

/**
 * Renders the search results dropdown.
 */
export const SearchDropdown = ({
  id,
  suggestions,
  activeIndex,
  query,
  onSelect,
  onHover,
}: SearchDropdownProps) => {
  return (
    <ul id={id} role="listbox" className={styles.dropdown}>
      {suggestions.map((item, index) => {
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
            <p className={styles.optionLabel}>
              <HighlightedText text={item.label} query={query} />
            </p>
            <p className={styles.optionSublabel}>
              <HighlightedText text={item.sublabel} query={query} />
            </p>
          </li>
        );
      })}
    </ul>
  );
};
