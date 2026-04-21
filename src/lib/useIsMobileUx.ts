import { useEffect, useState } from "react";

const COARSE_NO_HOVER_QUERY = "(pointer: coarse) and (hover: none)";

export const useIsMobileUx = () => {
  const [isMobileUx, setIsMobileUx] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(COARSE_NO_HOVER_QUERY);
    const onChange = () => {
      const uaDataMobile =
        (
          navigator as Navigator & { userAgentData?: { mobile?: boolean } }
        ).userAgentData?.mobile ?? false;
      const userAgentMobile =
        /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const touchOnlyDevice = media.matches && navigator.maxTouchPoints > 0;
      setIsMobileUx(uaDataMobile || userAgentMobile || touchOnlyDevice);
    };
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isMobileUx;
};
