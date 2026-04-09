"use client";

import type { CategoryId } from "@/types";
import type { ProductFilterOption } from "@/lib/merchantFilters";
import styles from "./FiltersModal.module.scss";

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

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{networkCategoryLabel}</p>
          <div className={styles.optionGrid}>
            {(Object.entries(networkLabels) as Array<[CategoryId, string]>).map(([id, label]) => {
              const isSelected = selectedNetworkIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`${styles.option} ${isSelected ? styles.optionActive : ""}`}
                  onClick={() => onToggleNetwork(id)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{productLabel}</p>
          <div className={styles.optionGrid}>
            {productOptions.length > 0 ? (
              productOptions.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`${styles.option} ${isSelected ? styles.optionActive : ""}`}
                    onClick={() => onToggleProduct(product.id)}
                  >
                    {product.label}
                  </button>
                );
              })
            ) : (
              <p className={styles.empty}>{noAvailableProductsLabel}</p>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>{cashbackLabel}</p>
          <button
            type="button"
            className={`${styles.option} ${cashbackOnly ? styles.optionActive : ""}`}
            onClick={onToggleCashback}
          >
            {cashbackOnlyLabel}
          </button>
        </div>

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
