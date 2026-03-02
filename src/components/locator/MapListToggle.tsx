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
      className="inline-flex items-center rounded-xl border border-white/50 bg-white/80 p-1 shadow-lg backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/80"
      role="tablist"
      aria-label="Map and list view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "map"}
        onClick={() => onChange("map")}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          value === "map"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {mapLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "list"}
        onClick={() => onChange("list")}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          value === "list"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {listLabel}
      </button>
    </div>
  );
}
