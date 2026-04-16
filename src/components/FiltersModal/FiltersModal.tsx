import { 
  Utensils, 
  Gift, 
  Car, 
  Bus, 
  Dumbbell, 
  BookOpen, 
  Palmtree, 
  Baby, 
  Shirt, 
  Sparkles, 
  Monitor, 
  Library, 
  HeartPulse, 
  ShieldCheck,
  Check
} from "lucide-react";
import type { CategoryId } from "@/types";
import type { ProductFilterOption, WalletFilterOption } from "@/lib/merchantFilters";
import styles from "./FiltersModal.module.scss";
import { FilterSection } from "./FilterSection/FilterSection";
import { FilterOption } from "./FilterOption/FilterOption";

const WALLET_ICONS: Record<string, React.ReactNode> = {
  meal: <Utensils size={20} />,
  rewards: <Gift size={20} />,
  mobility: <Car size={20} />,
  public_transport: <Bus size={20} />,
  wellness: <Dumbbell size={20} />,
  learning: <BookOpen size={20} />,
  vacations: <Palmtree size={20} />,
  childcare: <Baby size={20} />,
  clothing: <Shirt size={20} />,
  beauty: <Sparkles size={20} />,
  wfh: <Monitor size={20} />,
  culture: <Library size={20} />,
  health: <HeartPulse size={20} />,
  safety: <ShieldCheck size={20} />,
};

type FiltersModalProps = {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  networkCategoryLabel: string;
  productLabel: string;
  walletLabel: string;
  walletFlexOneLabel: string;
  cashbackLabel: string;
  cashbackOnlyLabel: string;
  clearAllFiltersLabel: string;
  applyFiltersLabel: string;
  noAvailableProductsLabel: string;
  networkLabels: Record<CategoryId, string>;
  walletLabels: Record<string, string>;
  selectedNetworkIds: CategoryId[];
  selectedProductIds: string[];
  selectedWalletIds: string[];
  isFlexOneWalletActive: boolean;
  productOptions: ProductFilterOption[];
  walletOptions: WalletFilterOption[];
  cashbackOnly: boolean;
  onClose: () => void;
  onToggleNetwork: (id: CategoryId) => void;
  onToggleProduct: (id: string) => void;
  onToggleWallet: (id: string) => void;
  onToggleAllWallets: (active: boolean) => void;
  onToggleCashback: () => void;
  onClearAll: () => void;
};

export const FiltersModal = ({
  isOpen,
  title,
  closeLabel,
  networkCategoryLabel,
  productLabel,
  walletLabel,
  walletFlexOneLabel,
  cashbackLabel,
  cashbackOnlyLabel,
  clearAllFiltersLabel,
  applyFiltersLabel,
  noAvailableProductsLabel,
  networkLabels,
  walletLabels,
  selectedNetworkIds,
  selectedProductIds,
  selectedWalletIds,
  isFlexOneWalletActive,
  productOptions,
  walletOptions,
  cashbackOnly,
  onClose,
  onToggleNetwork,
  onToggleProduct,
  onToggleWallet,
  onToggleAllWallets,
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

        <FilterSection title={walletLabel}>
          <div className={styles.walletHeader}>
            <button 
              type="button" 
              className={`${styles.parentToggle} ${isFlexOneWalletActive ? styles.parentToggleActive : ""}`}
              onClick={() => onToggleAllWallets(!isFlexOneWalletActive)}
            >
              <div className={styles.checkBox}>
                {isFlexOneWalletActive && <Check size={14} />}
              </div>
              <span>{walletFlexOneLabel}</span>
            </button>
          </div>
          <div className={styles.walletGrid}>
            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className={`${styles.walletTile} ${selectedWalletIds.includes(wallet.id) ? styles.walletTileActive : ""}`}
                onClick={() => onToggleWallet(wallet.id)}
              >
                <div className={styles.iconCircle}>
                  {WALLET_ICONS[wallet.id] || <Gift size={20} />}
                </div>
                <span className={styles.walletName}>
                  {walletLabels[wallet.id] || wallet.label}
                </span>
              </button>
            ))}
          </div>
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
