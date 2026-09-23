import { ICONS } from "@/shared/icons";
import { AppIconComponent } from "./icons.types";

/**
 * Hand-drawn icons that have no Phosphor equivalent. Empty today — the
 * merchant-locator set it used to hold went with the atlas rebuild — but this
 * is still the seam for adding one without touching the Phosphor registry.
 */
export const customIconRegistry: Partial<Record<ICONS, AppIconComponent>> = {};
