import type { PointerEvent, ReactNode } from "react";
import styles from "./Toast.module.scss";

export type ToastTone = "neutral" | "error";

type ToastProps = {
  tone?: ToastTone;
  message: string;
  children?: ReactNode;
  compact?: boolean;
  role?: "status" | "alert";
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const Toast = ({
  tone = "neutral",
  message,
  children,
  compact = false,
  role,
  onPointerDown,
}: ToastProps) => {
  const toneClass = tone === "error" ? styles.error : styles.neutral;
  const layoutClass = compact ? styles.compact : "";

  return (
    <div
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={[styles.toast, toneClass, layoutClass].filter(Boolean).join(" ")}
      onPointerDown={onPointerDown}
    >
      <span className={styles.message}>{message}</span>
      {children}
    </div>
  );
};
