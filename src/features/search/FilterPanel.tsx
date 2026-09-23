"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { strings } from "@/content/strings";
import {
  countActiveFilters,
  EMPTY_TEXTURE_FILTERS,
  getQuickFilterCategories,
  type TextureCategory,
  type TextureFilterState,
  type TextureLicense,
} from "@/domain/textures";
import { ICONS } from "@/shared/icons";
import { Icon, IconButton } from "@/shared/ui";
import styles from "./FilterPanel.module.scss";

export type FilterOptions = {
  neighborhoods: string[];
  formats: string[];
  tags: string[];
  licenses: TextureLicense[];
};

export type FilterPanelProps = {
  filters: TextureFilterState;
  options: FilterOptions;
  onChange: (filters: TextureFilterState) => void;
};

const LICENSE_LABELS: Record<TextureLicense, string> = {
  personal: strings.licensePersonal,
  commercial: strings.licenseCommercial,
  "cc-by": strings.licenseCcBy,
  "all-rights-reserved": strings.licenseAllRights,
};

/** Adds or removes `value`, leaving the rest of the list untouched. */
function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterPanel({ filters, options, onChange }: FilterPanelProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = countActiveFilters(filters);
  const quickCategories = getQuickFilterCategories();

  const toggleCategory = useCallback(
    (category: TextureCategory) => {
      onChange({ ...filters, categories: toggle(filters.categories, category) });
    },
    [filters, onChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const renderGroup = <T extends string>(
    title: string,
    values: readonly T[],
    selected: readonly T[],
    onToggle: (value: T) => void,
    labelFor: (value: T) => string = (value) => value,
    icon?: ICONS,
  ) => {
    if (values.length === 0) return null;
    return (
      <section className={styles.group}>
        <h4 className={styles.groupTitle}>
          {icon ? <Icon name={icon} className={styles.groupTitleIcon} aria-hidden /> : null}
          {title}
        </h4>
        <div className={styles.groupOptions}>
          {values.map((value) => {
            const isActive = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                aria-pressed={isActive}
                onClick={() => onToggle(value)}
              >
                {labelFor(value)}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.quickRow}>
        {quickCategories.map((category) => {
          const isActive = filters.categories.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              className={`${styles.quickChip} ${isActive ? styles.quickChipActive : ""}`}
              aria-pressed={isActive}
              style={isActive ? { borderColor: category.color } : undefined}
              onClick={() => toggleCategory(category.id)}
            >
              <Icon
                name={category.icon}
                className={styles.quickChipIcon}
                style={{ color: category.color }}
                aria-hidden
              />
              {category.label}
            </button>
          );
        })}

        <IconButton
          icon={ICONS.FADERS}
          aria-label={strings.openFilters}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`${styles.toggleBtn} ${activeCount > 0 ? styles.toggleBtnActive : ""}`}
          onClick={() => setIsOpen((open) => !open)}
        >
          {activeCount > 0 ? <span className={styles.badge}>{activeCount}</span> : null}
        </IconButton>
      </div>

      {isOpen ? (
        <div className={styles.panel} id={panelId}>
          {renderGroup<TextureCategory>(
            strings.category,
            quickCategories.map((category) => category.id),
            filters.categories,
            toggleCategory,
            (value) => quickCategories.find((c) => c.id === value)?.label ?? value,
          )}

          {renderGroup(strings.neighborhood, options.neighborhoods, filters.neighborhoods, (value) =>
            onChange({ ...filters, neighborhoods: toggle(filters.neighborhoods, value) }),
          )}

          {renderGroup(
            strings.format,
            options.formats,
            filters.formats,
            (value) => onChange({ ...filters, formats: toggle(filters.formats, value) }),
            (value) => value.toUpperCase(),
          )}

          {renderGroup<TextureLicense>(
            strings.license,
            options.licenses,
            filters.licenses,
            (value) => onChange({ ...filters, licenses: toggle(filters.licenses, value) }),
            (value) => LICENSE_LABELS[value] ?? value,
          )}

          {renderGroup(
            strings.tags,
            options.tags,
            filters.tags,
            (value) => onChange({ ...filters, tags: toggle(filters.tags, value) }),
            undefined,
            ICONS.TAG,
          )}

          {activeCount > 0 ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => onChange(EMPTY_TEXTURE_FILTERS)}
            >
              {strings.clearFilters}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
