/**
 * Canonical category list, managed in `categories.json` (and editable from the
 * local admin panel). Articles may use any category string in their frontmatter;
 * anything used but not listed here is still shown, appended after the managed
 * categories.
 */
import raw from "./categories.json";

export interface Category {
  name: string;
  slug: string;
  description?: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const managedCategories: Category[] = (raw as Category[]).map((c) => ({
  name: c.name,
  slug: c.slug || slugify(c.name),
  description: c.description,
}));

export function toCategory(name: string): Category {
  return { name, slug: slugify(name) };
}

/** Merge managed categories with any additional categories found in content. */
export function resolveCategories(used: string[]): Category[] {
  const managedNames = new Set(managedCategories.map((c) => c.name.toLowerCase()));
  const extras = [...new Set(used)]
    .filter((name) => name && !managedNames.has(name.toLowerCase()))
    .map(toCategory);
  return [...managedCategories, ...extras];
}
