import type { NetworkFilterOption } from "@/lib/merchantFilters";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { ICONS } from "@/enums";
import styles from "./FiltersModal.module.scss";
import { FilterSection } from "./FilterSection/FilterSection";
import { FilterOption } from "./FilterOption/FilterOption";

export type FiltersModalProps = {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  productLabel: string;
  cashbackLabel: string;
  cashbackOnlyLabel: string;
  clearAllFiltersLabel: string;
  noAvailableProductsLabel: string;
  selectedNetworkIds: string[];
  networkOptions: NetworkFilterOption[];
  cashbackOnly: boolean;
  onClose: () => void;
  onToggleNetwork: (id: string) => void;
  onToggleCashback: () => void;
  onClearAll: () => void;
};

export const FiltersModal = ({
  isOpen,
  title,
  closeLabel,
  productLabel,
  cashbackLabel,
  cashbackOnlyLabel,
  clearAllFiltersLabel,
  noAvailableProductsLabel,
  selectedNetworkIds,
  networkOptions,
  cashbackOnly,
  onClose,
  onToggleNetwork,
  onToggleCashback,
  onClearAll,
}: FiltersModalProps) => {
  if (!isOpen) return null;

  return (
    <section
      className={styles.modal}
      role="dialog"
      aria-modal
      aria-label={title}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <h3 className={styles.modalTitle}>{title}</h3>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.clearButton}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClearAll}
          >
            {clearAllFiltersLabel}
          </button>
          <IconButton
            icon={ICONS.X}
            className={styles.closeButton}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClose}
            aria-label={closeLabel}
          />
        </div>
      </div>

      <FilterSection title={productLabel}>
        {networkOptions.length > 0 ? (
          networkOptions.map((network) => (
            <FilterOption
              key={network.id}
              label={network.label}
              isSelected={selectedNetworkIds.includes(network.id)}
              onClick={() => onToggleNetwork(network.id)}
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
    </section>
  );
};
