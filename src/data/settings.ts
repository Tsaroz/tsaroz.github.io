import type { SiteSettings } from "./types";
import raw from "./content/settings.json";

export const settings: SiteSettings = raw as SiteSettings;
