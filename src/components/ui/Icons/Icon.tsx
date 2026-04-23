import { ReactNode } from "react";
import { ICONS } from "@/enums";
import { IIconProps } from "@/types";
import { IconRegistry } from "./iconsRegistry";

export type IconProps = IIconProps & {
  name: ICONS;
  fallback?: ReactNode;
};

export const Icon = ({ name, fallback = null, ...props }: IconProps) => {
  const IconComponent = IconRegistry[name];

  if (!IconComponent) {
    return <>{fallback}</>;
  }

  return <IconComponent {...props} />;
};
