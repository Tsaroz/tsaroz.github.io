import type { City } from "./types";
import raw from "./content/cities.json";

export const cities: City[] = raw as City[];
