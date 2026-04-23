import { ICONS } from "@/enums";
import { IIconProps } from "@/types";
import { ComponentType } from "react";
import { InfinitySearch } from "./Utility/InfinitySearch";
import { ArrowLeft } from "./Library/ArrowLeft";
import { Asclepius } from "./Library/Asclepius";
import { Barbell } from "./Library/Barbell";
import { Basket } from "./Library/Basket";
import { Coffee } from "./Library/Coffee";
import { Cookie } from "./Library/Cookie";
import { Faders } from "./Library/Faders";
import { ForkKnife } from "./Library/ForkKnife";
import { Globe } from "./Library/Globe";
import { MagnifyingGlass } from "./Library/MagnifyingGlass";
import { MapPin } from "./Library/MapPin";
import { Meal } from "./Library/Meal";
import { NavigationArrow } from "./Library/NavigationArrow";
import { Phone } from "./Library/Phone";
import { ShareNetwork } from "./Library/ShareNetwork";
import { SocialMediaIcon1 } from "./Library/SocialMediaIcon1";
import { SocialMediaIcon2 } from "./Library/SocialMediaIcon2";
import { SocialMediaIcon3 } from "./Library/SocialMediaIcon3";
import { SocialMediaIcon } from "./Library/SocialMediaIcon";
import { Storefront } from "./Library/Storefront";
import { Tag } from "./Library/Tag";
import { X } from "./Library/X";

export const IconRegistry: Record<ICONS, ComponentType<IIconProps>> = {
  [ICONS.ARROW_LEFT]: ArrowLeft,
  [ICONS.ASCLEPIUS]: Asclepius,
  [ICONS.BARBELL]: Barbell,
  [ICONS.BASKET]: Basket,
  [ICONS.COFFEE]: Coffee,
  [ICONS.COOKIE]: Cookie,
  [ICONS.FADERS]: Faders,
  [ICONS.FORK_KNIFE]: ForkKnife,
  [ICONS.GLOBE]: Globe,
  [ICONS.MAGNIFYING_GLASS]: MagnifyingGlass,
  [ICONS.MAP_PIN]: MapPin,
  [ICONS.MEAL]: Meal,
  [ICONS.NAVIGATION_ARROW]: NavigationArrow,
  [ICONS.PHONE]: Phone,
  [ICONS.SHARE_NETWORK]: ShareNetwork,
  [ICONS.SOCIAL_MEDIA_ICON_1]: SocialMediaIcon1,
  [ICONS.SOCIAL_MEDIA_ICON_2]: SocialMediaIcon2,
  [ICONS.SOCIAL_MEDIA_ICON_3]: SocialMediaIcon3,
  [ICONS.SOCIAL_MEDIA_ICON]: SocialMediaIcon,
  [ICONS.STOREFRONT]: Storefront,
  [ICONS.TAG]: Tag,
  [ICONS.X]: X,
  [ICONS.INFINITY_SEARCH]: InfinitySearch,
};
