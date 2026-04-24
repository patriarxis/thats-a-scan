import styles from "./ToastStack.module.scss";

export type ToastStackItem = {
  id: string;
  message: string;
  tone?: "neutral" | "error";
};

type ToastStackProps = {
  items: ToastStackItem[];
  className?: string;
};

export const ToastStack = ({ items, className }: ToastStackProps) => {
  if (items.length === 0) return null;

  return (
    <div className={[styles.stack, className].filter(Boolean).join(" ")} aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={`${styles.toast} ${item.tone === "error" ? styles.error : styles.neutral}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
};
