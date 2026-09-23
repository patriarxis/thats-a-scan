"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ATLAS_SEARCH_API_PATH } from "@/config/map";
import {
  SEARCH_MAP_MIN_QUERY_LENGTH,
  SEARCH_SUGGESTIONS_DEBOUNCE_MS,
  SEARCH_SUGGESTION_LIMIT,
} from "@/config/search";
import { strings } from "@/content/strings";
import {
  findCategoriesForQuery,
  getTextureId,
  type TextureCategory,
  type TextureFeature,
} from "@/domain/textures";
import { ICONS } from "@/shared/icons";
import { HighlightedText, Icon, IconButton } from "@/shared/ui";
import styles from "./SearchBar.module.scss";

type CategorySuggestion = ReturnType<typeof findCategoriesForQuery>[number];

export type SearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /** Called with the suggestion list so the map can pin those hits. */
  onResultsChange: (textures: TextureFeature[]) => void;
  onSelectTexture: (texture: TextureFeature) => void;
  onSelectCategory: (category: TextureCategory) => void;
};

type Row =
  | { kind: "category"; key: string; category: CategorySuggestion }
  | { kind: "texture"; key: string; texture: TextureFeature };

export function SearchBar({
  query,
  onQueryChange,
  onResultsChange,
  onSelectTexture,
  onSelectCategory,
}: SearchBarProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  /** Highlighted row, scoped to the query it was chosen for. */
  const [active, setActive] = useState<{ key: string; index: number }>({ key: "", index: 0 });
  const [fetched, setFetched] = useState<{ key: string; textures: TextureFeature[] }>({
    key: "",
    textures: [],
  });

  const trimmed = query.trim();
  const isSearchable = trimmed.length >= SEARCH_MAP_MIN_QUERY_LENGTH;
  const categories = useMemo(() => findCategoriesForQuery(trimmed), [trimmed]);
  // Results only count for the query they were fetched for, so a stale list
  // never shows against a newer query.
  const textures = useMemo(
    () => (fetched.key === trimmed ? fetched.textures : []),
    [fetched, trimmed],
  );

  const onResultsChangeRef = useRef(onResultsChange);
  useEffect(() => {
    onResultsChangeRef.current = onResultsChange;
  }, [onResultsChange]);

  // Debounced fetch against the search endpoint.
  useEffect(() => {
    if (!isSearchable) {
      onResultsChangeRef.current([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmed,
        limit: String(SEARCH_SUGGESTION_LIMIT),
      });
      fetch(`${ATLAS_SEARCH_API_PATH}?${params.toString()}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { features: [] }))
        .then((data: { features?: TextureFeature[] }) => {
          const next = Array.isArray(data.features) ? data.features : [];
          setFetched({ key: trimmed, textures: next });
          onResultsChangeRef.current(next);
        })
        .catch(() => {
          /* aborted or offline — keep the previous list */
        });
    }, SEARCH_SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [isSearchable, trimmed]);

  const rows = useMemo<Row[]>(() => {
    if (!isSearchable) return [];
    return [
      ...categories.map<Row>((category) => ({
        kind: "category",
        key: `category-${category.id}`,
        category,
      })),
      ...textures.map<Row>((texture) => ({
        kind: "texture",
        key: `texture-${getTextureId(texture)}`,
        texture,
      })),
    ];
  }, [categories, isSearchable, textures]);

  // Derived rather than stored: a new query resets the highlight to the first
  // row without an effect, and a shrinking list can never point past the end.
  const activeIndex =
    rows.length === 0 ? -1 : active.key === trimmed ? Math.min(active.index, rows.length - 1) : 0;

  const setActiveIndex = useCallback(
    (next: number) => setActive({ key: trimmed, index: next }),
    [trimmed],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clear = useCallback(() => {
    onQueryChange("");
    onResultsChangeRef.current([]);
    close();
    inputRef.current?.focus();
  }, [close, onQueryChange]);

  const commit = useCallback(
    (row: Row) => {
      if (row.kind === "category") {
        onSelectCategory(row.category.id);
      } else {
        onSelectTexture(row.texture);
      }
      close();
    },
    [close, onSelectCategory, onSelectTexture],
  );

  // Clicking away closes the suggestion list.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [close, isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isOpen) close();
      else clear();
      return;
    }

    if (rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((activeIndex + 1) % rows.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((activeIndex - 1 + rows.length) % rows.length);
      return;
    }

    if (event.key === "Enter") {
      const row = rows[activeIndex] ?? rows[0];
      if (!row) return;
      event.preventDefault();
      commit(row);
    }
  };

  const showList = isOpen && isSearchable;
  const activeRowId = activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;
  const categoryRows = rows.filter((row) => row.kind === "category");
  const textureRows = rows.filter((row) => row.kind === "texture");

  const renderRow = (row: Row) => {
    const index = rows.indexOf(row);
    const isActive = index === activeIndex;
    return (
      <li
        key={row.key}
        id={`${listboxId}-${index}`}
        role="option"
        aria-selected={isActive}
        className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
        onMouseEnter={() => setActiveIndex(index)}
        // Keep focus on the input so the keyboard stays usable after a click.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => commit(row)}
      >
        {row.kind === "category" ? (
          <>
            <span className={styles.optionIcon} style={{ color: row.category.color }}>
              <Icon name={row.category.icon} aria-hidden />
            </span>
            <span className={styles.optionLabel}>
              <HighlightedText text={row.category.label} query={trimmed} />
            </span>
          </>
        ) : (
          <>
            <span className={styles.optionIcon}>
              <Icon name={ICONS.MAP_PIN} aria-hidden />
            </span>
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>
                <HighlightedText text={row.texture.properties.title} query={trimmed} />
              </span>
              <span className={styles.optionMeta}>
                <HighlightedText text={row.texture.properties.neighborhood} query={trimmed} />
              </span>
            </span>
          </>
        )}
      </li>
    );
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.field}>
        <Icon name={ICONS.MAGNIFYING_GLASS} className={styles.fieldIcon} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          value={query}
          placeholder={strings.searchPlaceholder}
          aria-label={strings.searchAria}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={activeRowId}
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => {
            onQueryChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <IconButton
            icon={ICONS.X}
            size="sm"
            aria-label={strings.clearSearch}
            className={styles.clearBtn}
            onClick={clear}
          />
        ) : null}
      </div>

      {showList ? (
        <div className={styles.panel}>
          <ul className={styles.list} id={listboxId} role="listbox" aria-label={strings.searchAria}>
            {categoryRows.length > 0 ? (
              <>
                <li className={styles.sectionLabel} role="presentation">
                  {strings.searchSectionCategories}
                </li>
                {categoryRows.map(renderRow)}
              </>
            ) : null}

            {textureRows.length > 0 ? (
              <>
                <li className={styles.sectionLabel} role="presentation">
                  {strings.searchSectionTextures}
                </li>
                {textureRows.map(renderRow)}
              </>
            ) : null}

            {rows.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {strings.noResults}
              </li>
            ) : null}
          </ul>

          <div className={styles.hints}>
            <span className={styles.hint}>
              <Icon name={ICONS.ARROW_UP} aria-hidden />
              <Icon name={ICONS.ARROW_DOWN} aria-hidden />
              {strings.searchHintNavigate}
            </span>
            <span className={styles.hint}>
              <Icon name={ICONS.ARROW_ELBOW_DOWN_LEFT} aria-hidden />
              {strings.searchHintSelect}
            </span>
            <span className={styles.hint}>
              <kbd className={styles.kbd}>esc</kbd>
              {strings.searchHintClose}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
