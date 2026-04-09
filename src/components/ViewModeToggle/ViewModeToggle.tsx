import styles from "./ViewModeToggle.module.scss";

export type ViewMode = "map" | "list";

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  mapLabel: string;
  listLabel: string;
};

export const ViewModeToggle = ({
  value,
  onChange,
  mapLabel,
  listLabel
}: ViewModeToggleProps) => {
  return (
    <div
      className={styles.toggle}
      role="tablist"
      aria-label="Map and list view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "map"}
        onClick={() => onChange("map")}
        className={`${styles.tab} ${value === "map" ? styles.tabActive : ""}`}
      >
        {mapLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        className={`${styles.tab} ${value === "list" ? styles.tabActive : ""}`}
      >
        {listLabel}
      </button>
    </div>
  );
};

export const MapListToggle = ViewModeToggle;
