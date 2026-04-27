import React, { useCallback, useEffect, useRef, useState } from "react";
import { type MerchantDetailSheetProps } from "@/types";
import { MobileBottomDrawer } from "../MobileBottomDrawer/MobileBottomDrawer";
import { DesktopSideSheet } from "../DesktopSideSheet/DesktopSideSheet";
import { MerchantDetailContent } from "../PartnerDetailContent/PartnerDetailContent";

export const MerchantDetailSheet = (props: MerchantDetailSheetProps) => {
  const { partner, isMobile, onClose, closeSignal = 0 } = props;
  const [mobileCloseSignal, setMobileCloseSignal] = useState(0);
  const [desktopCloseSignal, setDesktopCloseSignal] = useState(0);
  const prevCloseSignalRef = useRef(closeSignal);

  if (!partner) return null;

  const handleContentClose = useCallback(() => {
    if (isMobile) {
      setMobileCloseSignal((value) => value + 1);
      return;
    }
    setDesktopCloseSignal((value) => value + 1);
  }, [isMobile]);

  const content = <MerchantDetailContent {...props} onClose={handleContentClose} />;

  useEffect(() => {
    const isNewCloseSignal = closeSignal !== prevCloseSignalRef.current;
    prevCloseSignalRef.current = closeSignal;
    if (!isNewCloseSignal || closeSignal <= 0) return;

    if (isMobile) {
      setMobileCloseSignal((value) => value + 1);
      return;
    }
    setDesktopCloseSignal((value) => value + 1);
  }, [closeSignal, isMobile]);

  if (isMobile) {
    return (
      <MobileBottomDrawer
        isOpen={!!partner}
        onClose={onClose}
        closeSignal={mobileCloseSignal}
        contentKey={partner.properties.ID}
      >
        {content}
      </MobileBottomDrawer>
    );
  }

  return (
    <DesktopSideSheet
      isOpen={!!partner}
      onClose={onClose}
      closeSignal={desktopCloseSignal}
      contentKey={partner.properties.ID}
    >
      {content}
    </DesktopSideSheet>
  );
};
