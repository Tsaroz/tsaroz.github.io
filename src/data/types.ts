

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;

  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ranking {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;

  cities?: string[];

  ad?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  rankingId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;

  image: string;
  imageAlt: string;
  upvotes: number;
  downvotes: number;

  votes7d?: number;

  comments7d?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  entryId: string;
  categoryId: string;
  author: string;
  body: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

export type EntryWithRank = Entry & { rank: number };

export function netScore(v: { upvotes: number; downvotes: number }): number {
  return v.upvotes - v.downvotes;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  district?: string;
  description: string;
}

export interface AdSettings {
  enabled: boolean;

  code: Record<string, string>;
}

export interface DesignSettings {
  theme: "light" | "dark" | "auto";
  font: "default" | "serif" | "grotesk" | "mono";
  size: "sm" | "md" | "lg" | "xl";

  brand: string;
}

export interface SiteSettings {
  ads: AdSettings;
  design: DesignSettings;

  notices?: Partial<Record<NoticeScope, string>>;
}

export type NoticeScope = "home" | "category" | "ranking" | "entry";

export const AD_SLOTS = [
  "home_top",
  "home_between",
  "category_top",
  "city_top",
  "ranking_top",
  "ranking_inline",
  "entry_top",
  "entry_after_comments",
  "search_top",
  "sitewide_bottom",
] as const;
