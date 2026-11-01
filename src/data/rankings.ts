import type { Ranking } from "./types";
import raw from "./content/rankings.json";

export const rankings: Ranking[] = raw as Ranking[];
