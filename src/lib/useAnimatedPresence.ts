import { useEffect, useRef, useState } from "react";

export function useAnimatedPresence(isOpen: boolean, exitDurationMs: number) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setIsMounted(true);
      setIsClosing(false);
      return;
    }
    if (!isMounted) return;
    setIsClosing(true);
    exitTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      exitTimerRef.current = null;
    }, exitDurationMs);
  }, [exitDurationMs, isMounted, isOpen]);

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [],
  );

  return { isMounted, isClosing };
}
