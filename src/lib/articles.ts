import { getCollection, type CollectionEntry } from "astro:content";

export type Article = CollectionEntry<"articles">;

export function slugOf(entry: Article): string {
  return entry.data.slug?.trim() || entry.id;
}

const SHOW_DRAFTS = import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_DRAFTS === "1";

export async function getArticles(): Promise<Article[]> {
  const all = await getCollection("articles", ({ data }) => SHOW_DRAFTS || !data.draft);
  return all.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
