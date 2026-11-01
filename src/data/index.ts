import { categories } from "./categories";
import { rankings } from "./rankings";
import { entries } from "./entries";
import { commentPools, expandedDiscussionSlugs, entryComments } from "./comments";
import { cities } from "./cities";
import { settings } from "./settings";
import { netScore, type Category, type Ranking, type Entry, type Comment, type EntryWithRank, type City, type SiteSettings } from "./types";

export { netScore, cities, settings };
export type { Category, Ranking, Entry, Comment, EntryWithRank, City, SiteSettings };

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function byScoreDesc(a: { upvotes: number; downvotes: number }, b: { upvotes: number; downvotes: number }) {
  return netScore(b) - netScore(a) || b.upvotes - a.upvotes;
}

export function getCategories(): Category[] {
  return [...categories];
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getRankings(): Ranking[] {
  return [...rankings];
}

export function getRankingBySlug(slug: string): Ranking | undefined {
  return rankings.find((r) => r.slug === slug);
}

export function getRankingById(id: string): Ranking | undefined {
  return rankings.find((r) => r.id === id);
}

export function getRankingsForCategory(categoryId: string): Ranking[] {
  return rankings
    .filter((r) => r.categoryId === categoryId)
    .sort((a, b) => rankingTotalVotes(b.id) - rankingTotalVotes(a.id));
}

export function getRankingsForCategorySlug(slug: string): Ranking[] {
  const cat = getCategoryBySlug(slug);
  return cat ? getRankingsForCategory(cat.id) : [];
}

export function getRankedEntries(rankingId: string): EntryWithRank[] {
  return entries
    .filter((e) => e.rankingId === rankingId)
    .sort(byScoreDesc)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function getRankedEntriesBySlug(rankingSlug: string): EntryWithRank[] {
  const r = getRankingBySlug(rankingSlug);
  return r ? getRankedEntries(r.id) : [];
}

export function getEntryById(id: string): Entry | undefined {
  return entries.find((e) => e.id === id);
}

export function getEntryDetail(rankingSlug: string, entrySlug: string) {
  const ranking = getRankingBySlug(rankingSlug);
  if (!ranking) return undefined;
  const ranked = getRankedEntries(ranking.id);
  const entry = ranked.find((e) => e.slug === entrySlug);
  if (!entry) return undefined;
  return {
    entry,
    ranking,
    category: getCategoryById(ranking.categoryId),
    totalItems: ranked.length,
  };
}

export function getCommentsForEntry(entry: Entry): Comment[] {
  const tied = (entryComments[entry.id] ?? []).map((p, i) => ({
    id: `${entry.id}:live:${i}`,
    entryId: entry.id,
    categoryId: entry.categoryId,
    author: p.author,
    body: p.body,
    upvotes: p.upvotes,
    downvotes: p.downvotes,
    createdAt: p.createdAt,
  }));
  const pool = commentPools[entry.categoryId] ?? [];
  if (pool.length === 0) return tied;
  const expanded = expandedDiscussionSlugs.has(entry.slug);
  const count = expanded ? pool.length : Math.min(6, pool.length);
  const offset = hashStr(entry.id) % pool.length;
  const picked: Comment[] = [];
  for (let i = 0; i < count; i++) {
    const p = pool[(offset + i) % pool.length];
    picked.push({
      id: `${entry.id}:${i}`,
      entryId: entry.id,
      categoryId: entry.categoryId,
      author: p.author,
      body: p.body,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      createdAt: p.createdAt,
    });
  }
  return [...tied, ...picked].sort(byScoreDesc);
}

export function getTopComments(entry: Entry, n = 3): Comment[] {
  return getCommentsForEntry(entry).slice(0, n);
}

export function countCommentsForEntry(entry: Entry): number {
  return getCommentsForEntry(entry).length;
}

export function rankingEntryCount(rankingId: string): number {
  return entries.filter((e) => e.rankingId === rankingId).length;
}

export function rankingTotalVotes(rankingId: string): number {
  return entries
    .filter((e) => e.rankingId === rankingId)
    .reduce((sum, e) => sum + e.upvotes + e.downvotes, 0);
}

export function rankingCommentCount(rankingId: string): number {
  return entries
    .filter((e) => e.rankingId === rankingId)
    .reduce((sum, e) => sum + countCommentsForEntry(e), 0);
}

export function categoryStats(slug: string) {
  const cat = getCategoryBySlug(slug);
  if (!cat) return { rankings: 0, entries: 0 };
  const rs = getRankingsForCategory(cat.id);
  return {
    rankings: rs.length,
    entries: rs.reduce((s, r) => s + rankingEntryCount(r.id), 0),
  };
}

export type DecoratedRanking = Ranking & {
  category: Category | undefined;
  entryCount: number;
  totalVotes: number;
  commentCount: number;

  activity7d: number;
  lifetimeScore: number;
  top: EntryWithRank[];
};

export function rankingActivity7d(rankingId: string): number {
  return entries
    .filter((e) => e.rankingId === rankingId)
    .reduce((s, e) => s + (e.votes7d ?? 0) + (e.comments7d ?? 0), 0);
}

export function decorate(r: Ranking): DecoratedRanking {
  return {
    ...r,
    category: getCategoryById(r.categoryId),
    entryCount: rankingEntryCount(r.id),
    totalVotes: rankingTotalVotes(r.id),
    commentCount: rankingCommentCount(r.id),
    activity7d: rankingActivity7d(r.id),
    lifetimeScore: rankingTotalVotes(r.id) + rankingCommentCount(r.id),
    top: getRankedEntries(r.id).slice(0, 3),
  };
}

export function allDecorated(): DecoratedRanking[] {
  return rankings.map(decorate);
}

export function trendingRankings(limit = 20): DecoratedRanking[] {
  const list = allDecorated();
  const anyActivity = list.some((r) => r.activity7d > 0);
  return list
    .sort((a, b) =>
      anyActivity
        ? b.activity7d - a.activity7d || b.totalVotes - a.totalVotes
        : +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, limit);
}

export function popularRankings(limit = 20): DecoratedRanking[] {
  return allDecorated()
    .sort((a, b) => b.lifetimeScore - a.lifetimeScore)
    .slice(0, limit);
}

export function newRankings(limit = 20): DecoratedRanking[] {
  return allDecorated()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit);
}

export function getCities(): City[] {
  return [...cities];
}

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}

export function getRankingsForCity(citySlug: string): DecoratedRanking[] {
  return rankings
    .filter((r) => (r.cities ?? []).includes(citySlug))
    .map(decorate)
    .sort((a, b) => b.lifetimeScore - a.lifetimeScore);
}

export function getSettings(): SiteSettings {
  return settings;
}

export function buildSearchIndex() {
  return [
    ...categories.map((c) => ({ t: "Category" as const, n: c.name, u: `/category/${c.slug}/`, h: c.description })),
    ...rankings.map((r) => ({
      t: "Ranking" as const,
      n: r.title,
      u: `/ranking/${r.slug}/`,
      h: getCategoryById(r.categoryId)?.name ?? "",
    })),
    ...entries.map((e) => {
      const r = getRankingById(e.rankingId);
      return { t: "Entry" as const, n: e.name, u: `/ranking/${r?.slug ?? ""}/${e.slug}/`, h: r?.title ?? "" };
    }),
  ];
}
