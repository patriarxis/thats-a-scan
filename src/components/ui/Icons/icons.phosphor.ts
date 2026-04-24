import { ICONS } from "@/enums";
import { IIconProps } from "@/types";
import { ComponentType, createElement } from "react";
import {
  ArrowLeftIcon,
  AsclepiusIcon,
  BarbellIcon,
  BasketIcon,
  CoffeeIcon,
  CookieIcon,
  FadersIcon,
  ForkKnifeIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PhoneIcon,
  ShareNetworkIcon,
  StorefrontIcon,
  TagIcon,
  XIcon,
  type IconProps as PhosphorIconProps,
} from "@phosphor-icons/react";
import { AppIconComponent } from "./icons.types";

const withPhosphorFill = (
  IconComponent: ComponentType<PhosphorIconProps>,
  defaultWeight: PhosphorIconProps["weight"] = "fill",
): AppIconComponent => {
  const WrappedIcon = ({ ...props }: IIconProps) =>
    createElement(IconComponent, {
      ...(props as unknown as PhosphorIconProps),
      weight: (props as { weight?: PhosphorIconProps["weight"] }).weight ?? defaultWeight,
    });
  return WrappedIcon;
};

export const phosphorIconRegistry: Partial<Record<ICONS, AppIconComponent>> = {
  [ICONS.ARROW_LEFT]: withPhosphorFill(ArrowLeftIcon),
  [ICONS.ASCLEPIUS]: withPhosphorFill(AsclepiusIcon),
  [ICONS.BARBELL]: withPhosphorFill(BarbellIcon),
  [ICONS.BASKET]: withPhosphorFill(BasketIcon),
  [ICONS.COFFEE]: withPhosphorFill(CoffeeIcon),
  [ICONS.COOKIE]: withPhosphorFill(CookieIcon),
  [ICONS.FADERS]: withPhosphorFill(FadersIcon),
  [ICONS.FORK_KNIFE]: withPhosphorFill(ForkKnifeIcon),
  [ICONS.GLOBE]: withPhosphorFill(GlobeIcon),
  [ICONS.MAGNIFYING_GLASS]: withPhosphorFill(MagnifyingGlassIcon),
  [ICONS.MAP_PIN]: withPhosphorFill(MapPinIcon),
  [ICONS.NAVIGATION_ARROW]: withPhosphorFill(NavigationArrowIcon),
  [ICONS.PHONE]: withPhosphorFill(PhoneIcon),
  [ICONS.SHARE_NETWORK]: withPhosphorFill(ShareNetworkIcon),
  [ICONS.STOREFRONT]: withPhosphorFill(StorefrontIcon),
  [ICONS.TAG]: withPhosphorFill(TagIcon),
  [ICONS.X]: withPhosphorFill(XIcon, "bold"),
};
