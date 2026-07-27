import { ICONS } from "@/shared/icons";
import { InfinitySearch } from "./Utility/InfinitySearch";
import { Facebook } from "./Library/Facebook";
import { Instagram } from "./Library/Instagram";
import { Linkedin } from "./Library/Linkedin";
import { Meal } from "./Library/Meal";
import { Tiktok } from "./Library/Tiktok";
import { AppIconComponent } from "./icons.types";

export const customIconRegistry: Partial<Record<ICONS, AppIconComponent>> = {
  [ICONS.MEAL]: Meal,
  [ICONS.LINKEDIN]: Linkedin,
  [ICONS.INSTAGRAM]: Instagram,
  [ICONS.TIKTOK]: Tiktok,
  [ICONS.FACEBOOK]: Facebook,
  [ICONS.INFINITY_SEARCH]: InfinitySearch,
};
