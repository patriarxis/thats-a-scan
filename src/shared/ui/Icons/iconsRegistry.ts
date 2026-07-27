import { ICONS } from "@/shared/icons";
import { AppIconComponent } from "./icons.types";
import { phosphorIconRegistry } from "./icons.phosphor";
import { customIconRegistry } from "./icons.custom";

export const IconRegistry: Record<ICONS, AppIconComponent> = {
  ...phosphorIconRegistry,
  ...customIconRegistry,
} as Record<ICONS, AppIconComponent>;
