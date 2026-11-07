import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"articles">;

export function slugOf(entry: Article): string {
  return entry.data.slug?.trim() || entry.id;
}

const SHOW_DRAFTS = import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_DRAFTS === "1";

const updatedAtOf = (a: Article) =>
  (a.data.updatedAt ?? a.data.publishedAt).getTime();

/** Articles in curated order (manual `order` first, then newest update). */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection("articles", ({ data }) => SHOW_DRAFTS || !data.draft);
  return all.sort((a, b) => {
    const ao = a.data.order;
    const bo = b.data.order;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return updatedAtOf(b) - updatedAtOf(a);
  });
}

/** Articles sorted purely by most recently updated — feeds "Latest". */
export async function getLatestArticles(): Promise<Article[]> {
  const all = await getCollection("articles", ({ data }) => SHOW_DRAFTS || !data.draft);
  return all.sort((a, b) => updatedAtOf(b) - updatedAtOf(a));
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
