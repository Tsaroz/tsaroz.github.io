import type { Entry } from "./types";
import raw from "./content/entries.json";

export const entries: Entry[] = raw as Entry[];
