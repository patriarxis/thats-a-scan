import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./DesktopSideSheet.module.scss";

interface DesktopSideSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  isOpen: boolean;
  closeSignal?: number;
  contentKey?: string | number;
}

const CLOSE_ANIMATION_MS = 320;

export const DesktopSideSheet = ({
  children,
  onClose,
  isOpen,
  closeSignal = 0,
  contentKey,
}: DesktopSideSheetProps) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const prevCloseSignalRef = useRef(closeSignal);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [contentKey]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const startClose = useCallback(() => {
    clearCloseTimer();
    setIsClosing((value) => (value ? value : true));
    closeTimerRef.current = window.setTimeout(() => {
      setIsRendered(false);
      onCloseRef.current();
    }, CLOSE_ANIMATION_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!isOpen && isRendered && !isClosing) {
      startClose();
    }
  }, [isClosing, isOpen, isRendered, startClose]);

  useEffect(() => {
    const isNewCloseSignal = closeSignal !== prevCloseSignalRef.current;
    prevCloseSignalRef.current = closeSignal;
    if (isNewCloseSignal && closeSignal > 0 && !isClosing) {
      startClose();
    }
  }, [closeSignal, isClosing, startClose]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  if (!isRendered) return null;

  return (
    <aside
      className={`${styles.desktopSheet} ${isClosing ? styles.closing : ""}`}
      data-sheet-variant="desktop"
      role="region"
      aria-label="Merchant details panel"
    >
      <div className={styles.desktopContent} ref={contentRef}>
        {children}
      </div>
    </aside>
  );
};
