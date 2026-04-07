import styles from "./MapListToggle.module.scss";

type ViewMode = "map" | "list";

type MapListToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  mapLabel: string;
  listLabel: string;
};

export function MapListToggle({
  value,
  onChange,
  mapLabel,
  listLabel
}: MapListToggleProps) {
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
}
