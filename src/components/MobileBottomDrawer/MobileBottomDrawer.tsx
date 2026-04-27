import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./MobileBottomDrawer.module.scss";

interface MobileBottomDrawerProps {
  children: React.ReactNode;
  onClose: () => void;
  isOpen: boolean;
  closeSignal?: number;
  contentKey?: string | number;
}

const CLOSE_ANIMATION_MS = 320;
const GESTURE_INTENT_THRESHOLD = 8;
const PEEK_TO_CLOSE_THRESHOLD = 96;
const PEEK_TO_FULL_THRESHOLD = 90;
const FULL_TO_PEEK_THRESHOLD = 90;
const FULL_TO_CLOSE_THRESHOLD = 180;
const PEEK_HEIGHT_RATIO = 0.42;
const PEEK_HEIGHT_MAX_PX = 30 * 16;
const FULL_HEIGHT_RATIO = 0.8;

export const MobileBottomDrawer = ({
  children,
  onClose,
  isOpen,
  closeSignal = 0,
  contentKey,
}: MobileBottomDrawerProps) => {
  const [drawerState, setDrawerState] = useState<"peek" | "full" | "closed">("closed");
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [viewportHeight, setViewportHeight] = useState(0);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentYRef = useRef(0);
  const dragStartStateRef = useRef<"peek" | "full" | "closed">("peek");
  const startedAtTopRef = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const prevCloseSignalRef = useRef(closeSignal);
  const gestureModeRef = useRef<"undecided" | "vertical" | "horizontal">(
    "undecided"
  );
  const startedOnHandleRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const startClose = useCallback(
    (notifyParent: boolean) => {
      clearCloseTimer();
      setIsDragging(false);
      setDragY(0);
      setDrawerState("closed");

      closeTimerRef.current = window.setTimeout(() => {
        setIsRendered(false);
        if (notifyParent) {
          onClose();
        }
      }, CLOSE_ANIMATION_MS);
    },
    [clearCloseTimer, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      clearCloseTimer();
      setIsRendered(true);
      setDrawerState((state) => (state === "closed" ? "peek" : state));
      return;
    }

    if (isRendered) {
      startClose(false);
    }
  }, [clearCloseTimer, isOpen, isRendered, startClose]);

  useEffect(() => {
    const isNewCloseSignal = closeSignal !== prevCloseSignalRef.current;
    prevCloseSignalRef.current = closeSignal;
    if (isNewCloseSignal && closeSignal > 0) {
      startClose(true);
    }
  }, [closeSignal, startClose]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  useEffect(() => {
    if (drawerState !== "full" && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [drawerState, isDragging]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [contentKey]);

  useEffect(() => {
    const syncViewportHeight = () => setViewportHeight(window.innerHeight);
    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    return () => window.removeEventListener("resize", syncViewportHeight);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
    gestureModeRef.current = "undecided";
    startedOnHandleRef.current = !!target.closest('[data-drawer-handle="true"]');
    dragStartStateRef.current = drawerState;
    startedAtTopRef.current = contentRef.current ? contentRef.current.scrollTop <= 0 : true;
    setIsDragging(true);
    setDragY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    if (gestureModeRef.current === "undecided") {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < GESTURE_INTENT_THRESHOLD && absY < GESTURE_INTENT_THRESHOLD) {
        return;
      }
      gestureModeRef.current = absX > absY ? "horizontal" : "vertical";
    }

    if (gestureModeRef.current === "horizontal") {
      setIsDragging(false);
      return;
    }

    const isAtTop = contentRef.current ? contentRef.current.scrollTop <= 0 : true;
    const draggingDown = deltaY > 0;
    const canDragFromContent =
      drawerState === "peek" ||
      (drawerState === "full" && startedAtTopRef.current && draggingDown && isAtTop);
    const canDragDrawer = startedOnHandleRef.current || canDragFromContent;

    if (!canDragDrawer) {
      setIsDragging(false);
      return;
    }

    if (e.cancelable) e.preventDefault();
    setDragY(deltaY);
    currentYRef.current = currentY;
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const draggedDown = deltaY > 0;
    const dragDistance = Math.abs(deltaY);

    const startState = dragStartStateRef.current;

    if (draggedDown) {
      if (startState === "full") {
        if (dragDistance >= FULL_TO_CLOSE_THRESHOLD) {
          startClose(true);
        } else if (dragDistance >= FULL_TO_PEEK_THRESHOLD) {
          setDrawerState("peek");
        }
      } else if (startState === "peek" && dragDistance >= PEEK_TO_CLOSE_THRESHOLD) {
        startClose(true);
      }
    } else if (startState === "peek" && dragDistance >= PEEK_TO_FULL_THRESHOLD) {
      setDrawerState("full");
    }
    setDragY(0);
  };

  const getPeekHeightPx = () => {
    const height = viewportHeight || 800;
    return Math.min(height * PEEK_HEIGHT_RATIO, PEEK_HEIGHT_MAX_PX);
  };

  const getFullHeightPx = () => {
    const height = viewportHeight || 800;
    return height * FULL_HEIGHT_RATIO;
  };

  const getDrawerMetrics = () => {
    const vh = viewportHeight || 800;
    const peekHeight = getPeekHeightPx();
    const fullHeight = getFullHeightPx();
    const closedTranslate = vh + 120;

    if (drawerState === "closed") {
      return { heightPx: peekHeight, translatePx: closedTranslate };
    }

    if (!isDragging) {
      return {
        heightPx: drawerState === "full" ? fullHeight : peekHeight,
        translatePx: 0,
      };
    }

    const startState = dragStartStateRef.current;
    if (startState === "peek") {
      if (dragY < 0) {
        return {
          heightPx: Math.min(fullHeight, peekHeight + Math.abs(dragY)),
          translatePx: 0,
        };
      }
      return {
        heightPx: peekHeight,
        translatePx: Math.max(0, dragY),
      };
    }

    if (startState === "full") {
      if (dragY <= 0) {
        return { heightPx: fullHeight, translatePx: 0 };
      }
      const collapsedHeight = Math.max(peekHeight, fullHeight - dragY);
      const extraDragAfterPeek = Math.max(0, dragY - (fullHeight - peekHeight));
      return {
        heightPx: collapsedHeight,
        translatePx: extraDragAfterPeek,
      };
    }

    return { heightPx: peekHeight, translatePx: 0 };
  };

  if (!isRendered) return null;
  const { heightPx, translatePx } = getDrawerMetrics();
  const shouldAllowContentScroll = drawerState === "full" && !isDragging;

  return (
    <aside
      className={`${styles.sheet} ${isDragging ? styles.isDragging : ""}`}
      data-sheet-variant="mobile"
      data-drawer-state={drawerState}
      style={{
        height: `${heightPx}px`,
        transform: `translateY(${translatePx}px)`,
      }}
    >
      <div
        className={styles.handleBar}
        data-drawer-handle="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className={styles.handle} />
      </div>
      <div
        className={`${styles.content} ${
          !shouldAllowContentScroll ? styles.contentLocked : ""
        }`}
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchMoveCapture={
          !shouldAllowContentScroll
            ? (e) => {
                if (e.cancelable) e.preventDefault();
              }
            : undefined
        }
        onWheelCapture={
          !shouldAllowContentScroll
            ? (e) => {
                e.preventDefault();
              }
            : undefined
        }
        onScrollCapture={
          !shouldAllowContentScroll
            ? () => {
                if (contentRef.current) contentRef.current.scrollTop = 0;
              }
            : undefined
        }
      >
        {children}
      </div>
    </aside>
  );
};
