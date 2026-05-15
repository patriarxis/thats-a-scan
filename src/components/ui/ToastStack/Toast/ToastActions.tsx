import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { ICONS } from "@/enums";
import styles from "./ToastActions.module.scss";

type ToastActionsProps = {
  children?: ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
};

export const ToastActions = ({ children, dismissLabel, onDismiss }: ToastActionsProps) => {
  if (!children && !onDismiss) return null;

  return (
    <div className={styles.actions}>
      {children}
      {onDismiss && (
        <IconButton
          icon={ICONS.X}
          size="sm"
          variant="ghost"
          className={styles.dismiss}
          aria-label={dismissLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        />
      )}
    </div>
  );
};
