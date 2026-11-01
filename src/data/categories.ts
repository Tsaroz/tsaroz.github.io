import type { Category } from "./types";
import raw from "./content/categories.json";

export const categories: Category[] = raw as Category[];
