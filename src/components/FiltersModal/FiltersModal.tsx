"use client";

import type { CategoryId } from "@/types";
import type { ProductFilterOption } from "@/lib/merchantFilters";
import styles from "./FiltersModal.module.scss";
import { FilterSection } from "./FilterSection/FilterSection";
import { FilterOption } from "./FilterOption/FilterOption";

type FiltersModalProps = {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  networkCategoryLabel: string;
  productLabel: string;
  cashbackLabel: string;
  cashbackOnlyLabel: string;
  clearAllFiltersLabel: string;
  applyFiltersLabel: string;
  noAvailableProductsLabel: string;
  networkLabels: Record<CategoryId, string>;
  selectedNetworkIds: CategoryId[];
  selectedProductIds: string[];
  productOptions: ProductFilterOption[];
  cashbackOnly: boolean;
  onClose: () => void;
  onToggleNetwork: (id: CategoryId) => void;
  onToggleProduct: (id: string) => void;
  onToggleCashback: () => void;
  onClearAll: () => void;
};

export const FiltersModal = ({
  isOpen,
  title,
  closeLabel,
  networkCategoryLabel,
  productLabel,
  cashbackLabel,
  cashbackOnlyLabel,
  clearAllFiltersLabel,
  applyFiltersLabel,
  noAvailableProductsLabel,
  networkLabels,
  selectedNetworkIds,
  selectedProductIds,
  productOptions,
  cashbackOnly,
  onClose,
  onToggleNetwork,
  onToggleProduct,
  onToggleCashback,
  onClearAll,
}: FiltersModalProps) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal aria-label={title}>
        <div className={styles.header}>
          <h3>{title}</h3>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            {closeLabel}
          </button>
        </div>

        <FilterSection title={networkCategoryLabel}>
          {(Object.entries(networkLabels) as Array<[CategoryId, string]>).map(([id, label]) => (
            <FilterOption
              key={id}
              label={label}
              isSelected={selectedNetworkIds.includes(id)}
              onClick={() => onToggleNetwork(id)}
            />
          ))}
        </FilterSection>

        <FilterSection title={productLabel}>
          {productOptions.length > 0 ? (
            productOptions.map((product) => (
              <FilterOption
                key={product.id}
                label={product.label}
                isSelected={selectedProductIds.includes(product.id)}
                onClick={() => onToggleProduct(product.id)}
              />
            ))
          ) : (
            <p className={styles.empty}>{noAvailableProductsLabel}</p>
          )}
        </FilterSection>

        <FilterSection title={cashbackLabel}>
          <FilterOption
            label={cashbackOnlyLabel}
            isSelected={cashbackOnly}
            onClick={onToggleCashback}
          />
        </FilterSection>

        <div className={styles.footer}>
          <button type="button" className={styles.clearButton} onClick={onClearAll}>
            {clearAllFiltersLabel}
          </button>
          <button type="button" className={styles.applyButton} onClick={onClose}>
            {applyFiltersLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
