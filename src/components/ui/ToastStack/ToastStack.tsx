import type { PointerEvent } from "react";
import { Toast, ToastActions } from "./Toast";
import styles from "./ToastStack.module.scss";

export type ToastStackItem = {
  id: string;
  message: string;
  tone?: "neutral" | "error";
  onDismiss?: () => void;
  dismissLabel?: string;
};

type ToastStackProps = {
  items: ToastStackItem[];
  className?: string;
};

export const ToastStack = ({ items, className }: ToastStackProps) => {
  if (items.length === 0) return null;

  const stopMapPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className={[styles.stack, className].filter(Boolean).join(" ")}
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item) => {
        const isDismissible = Boolean(item.onDismiss);
        return (
          <Toast
            key={item.id}
            tone={item.tone}
            message={item.message}
            compact={isDismissible}
            onPointerDown={isDismissible ? stopMapPointer : undefined}
          >
            {isDismissible && (
              <ToastActions
                dismissLabel={item.dismissLabel}
                onDismiss={item.onDismiss}
              />
            )}
          </Toast>
        );
      })}
    </div>
  );
};
