"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAnimatedPresence } from "@/lib/useAnimatedPresence";

type BackdropProps = {
  isOpen: boolean;
  onClick?: () => void;
  className: string;
  openClassName?: string;
  closingClassName?: string;
  exitDurationMs?: number;
  children?: ReactNode;
};

export const Backdrop = ({
  isOpen,
  onClick,
  className,
  openClassName,
  closingClassName,
  exitDurationMs = 180,
  children,
}: BackdropProps) => {
  const { isMounted, isClosing } = useAnimatedPresence(isOpen, exitDurationMs);
  const [isEntered, setIsEntered] = useState(false);

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
    className,
    isEntered && !isClosing && openClassName ? openClassName : "",
    isClosing && closingClassName ? closingClassName : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={composedClassName} onClick={onClick} role="presentation">
      {children}
    </div>
  );
};
