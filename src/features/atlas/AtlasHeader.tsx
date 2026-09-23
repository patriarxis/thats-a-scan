"use client";

import { modalLabels } from "@/content/strings";
import type {
  TextureCategory,
  TextureFeature,
  TextureFilterState,
} from "@/domain/textures";
import { FilterPanel, type FilterOptions } from "@/features/search/FilterPanel";
import { SearchBar } from "@/features/search/SearchBar";
import styles from "./AtlasHeader.module.scss";

export type AtlasHeaderProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchResultsChange: (textures: TextureFeature[]) => void;
  onSelectTexture: (texture: TextureFeature) => void;
  onSelectCategory: (category: TextureCategory) => void;
  filters: TextureFilterState;
  filterOptions: FilterOptions;
  onFiltersChange: (filters: TextureFilterState) => void;
};

export function AtlasHeader({
  searchQuery,
  onSearchQueryChange,
  onSearchResultsChange,
  onSelectTexture,
  onSelectCategory,
  filters,
  filterOptions,
  onFiltersChange,
}: AtlasHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.leading}>
        <div className={styles.brandTag}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden>
              ◈
            </span>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Textures Atlas</span>
              <span className={styles.brandSubtitle}>{modalLabels.atlasFieldCatalog}</span>
            </div>
          </div>
        </div>

        <SearchBar
          query={searchQuery}
          onQueryChange={onSearchQueryChange}
          onResultsChange={onSearchResultsChange}
          onSelectTexture={onSelectTexture}
          onSelectCategory={onSelectCategory}
        />
      </div>

      <FilterPanel filters={filters} options={filterOptions} onChange={onFiltersChange} />
    </header>
  );
}
