"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseSearchFocusShellArgs = {
  mobileMediaQuery: string;
  closeAnimationMs: number;
  onMobileBack?: () => boolean | void;
};

export function useSearchFocusShell({
  mobileMediaQuery,
  closeAnimationMs,
  onMobileBack,
}: UseSearchFocusShellArgs) {
  const [isFocused, setIsFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(
    null,
  );
  const closeTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const historyEntryActiveRef = useRef(false);
  const handlingPopStateRef = useRef(false);

  const isFocusShellActive = isFocused || isClosing;

  const getIsMobileViewport = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(mobileMediaQuery).matches,
    [mobileMediaQuery],
  );

  const closeFocusShellDirect = useCallback(
    (onAfterClose?: () => void) => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      setIsFocused(false);
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setIsClosing(false);
        historyEntryActiveRef.current = false;
        handlingPopStateRef.current = false;
        closeTimerRef.current = null;
        onAfterClose?.();
      }, closeAnimationMs);
    },
    [closeAnimationMs],
  );

  const closeFocusShell = useCallback(
    (onAfterClose?: () => void) => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.blur();
      }
      if (typeof window === "undefined") {
        setIsFocused(false);
        setIsClosing(false);
        onAfterClose?.();
        return;
      }
      const isMobileViewport = getIsMobileViewport();
      if (!isMobileViewport) {
        setIsFocused(false);
        setIsClosing(false);
        onAfterClose?.();
        return;
      }
      if (historyEntryActiveRef.current && !handlingPopStateRef.current) {
        window.history.back();
        return;
      }
      closeFocusShellDirect(onAfterClose);
    },
    [closeFocusShellDirect, getIsMobileViewport],
  );

  const handleInputFocus = useCallback(
    (onFocusInput?: () => void) => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsClosing(false);
      setIsFocused(true);
      onFocusInput?.();
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobileViewport = getIsMobileViewport();
    if (!isMobileViewport) return;
    document.body.style.overflow = isFocusShellActive ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [getIsMobileViewport, isFocusShellActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getIsMobileViewport()) return;
    if (!isFocusShellActive || historyEntryActiveRef.current) return;
    window.history.pushState(
      { ...(window.history.state ?? {}), __searchOverlayOpen: true },
      "",
      window.location.href,
    );
    historyEntryActiveRef.current = true;
  }, [getIsMobileViewport, isFocusShellActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      if (!historyEntryActiveRef.current) return;
      if (!isFocusShellActive) {
        historyEntryActiveRef.current = false;
        return;
      }
      if (onMobileBack?.()) {
        return;
      }
      handlingPopStateRef.current = true;
      closeFocusShellDirect();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeFocusShellDirect, isFocusShellActive, onMobileBack]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isFocusShellActive) {
      setMobileViewportHeight(null);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      setMobileViewportHeight(window.innerHeight);
      return;
    }

    const syncHeight = () => {
      setMobileViewportHeight(Math.round(viewport.height));
    };

    syncHeight();
    viewport.addEventListener("resize", syncHeight);
    viewport.addEventListener("scroll", syncHeight);

    return () => {
      viewport.removeEventListener("resize", syncHeight);
      viewport.removeEventListener("scroll", syncHeight);
    };
  }, [isFocusShellActive]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const wrapperStyle = useMemo(
    () =>
      mobileViewportHeight && isFocusShellActive
        ? ({ "--mobile-search-vh": `${mobileViewportHeight}px` } as CSSProperties)
        : undefined,
    [isFocusShellActive, mobileViewportHeight],
  );

  return {
    inputRef,
    isFocused,
    isClosing,
    isFocusShellActive,
    wrapperStyle,
    closeFocusShell,
    closeFocusShellDirect,
    handleInputFocus,
  };
}
