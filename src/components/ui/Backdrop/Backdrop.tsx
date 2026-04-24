"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";
import styles from "./Backdrop.module.scss";

type BackdropProps = {
  isOpen: boolean;
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "strong";
  usePortal?: boolean;
  exitDurationMs?: number;
  children?: ReactNode;
};

export const Backdrop = ({
  isOpen,
  onClick,
  className,
  contentClassName,
  tone = "default",
  usePortal = true,
  exitDurationMs = 100,
  children,
}: BackdropProps) => {
  const { isMounted, isClosing } = useAnimatedPresence(isOpen, exitDurationMs);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      setIsEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isMounted]);

  if (!isMounted) return null;

  const composedClassName = [
    styles.backdrop,
    tone === "strong" ? styles.strong : "",
    isEntered && !isClosing ? styles.open : "",
    isClosing ? styles.closing : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const backdropNode = (
    <div className={composedClassName} onClick={onClick} role="presentation">
      {children ? <div className={contentClassName}>{children}</div> : null}
    </div>
  );

  if (!usePortal) return backdropNode;
  if (!portalTarget) return null;
  return createPortal(backdropNode, portalTarget);
};
