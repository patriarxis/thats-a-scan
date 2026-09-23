import { ICONS } from "@/shared/icons";
import { IIconProps } from "@/types";
import { ComponentType, createElement } from "react";
import {
  ArrowDownIcon,
  ArrowElbowDownLeftIcon,
  ArrowUpIcon,
  BookOpenTextIcon,
  BuildingsIcon,
  FadersIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PaletteIcon,
  ShareNetworkIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
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
  [ICONS.ARROW_UP]: withPhosphorFill(ArrowUpIcon),
  [ICONS.ARROW_DOWN]: withPhosphorFill(ArrowDownIcon),
  [ICONS.ARROW_ELBOW_DOWN_LEFT]: withPhosphorFill(ArrowElbowDownLeftIcon),
  [ICONS.BOOK_OPEN_TEXT]: withPhosphorFill(BookOpenTextIcon),
  [ICONS.BUILDINGS]: withPhosphorFill(BuildingsIcon),
  [ICONS.FADERS]: withPhosphorFill(FadersIcon),
  [ICONS.MAGNIFYING_GLASS]: withPhosphorFill(MagnifyingGlassIcon),
  [ICONS.MAP_PIN]: withPhosphorFill(MapPinIcon),
  [ICONS.PALETTE]: withPhosphorFill(PaletteIcon),
  [ICONS.SHARE_NETWORK]: withPhosphorFill(ShareNetworkIcon),
  [ICONS.SHIELD_CHECK]: withPhosphorFill(ShieldCheckIcon),
  [ICONS.SHOPPING_BAG]: withPhosphorFill(ShoppingBagIcon),
  [ICONS.STOREFRONT]: withPhosphorFill(StorefrontIcon),
  [ICONS.TAG]: withPhosphorFill(TagIcon),
  [ICONS.X]: withPhosphorFill(XIcon, "bold"),
};
