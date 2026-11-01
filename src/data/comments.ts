import type { Comment } from "./types";
import raw from "./content/comments.json";

type PoolRow = Omit<Comment, "id" | "entryId" | "categoryId">;

const store = raw as { pools: Record<string, PoolRow[]>; expanded: string[]; entryComments?: Record<string, PoolRow[]> };

export const commentPools: Record<string, PoolRow[]> = store.pools;
export const expandedDiscussionSlugs = new Set(store.expanded);

export const entryComments: Record<string, PoolRow[]> = store.entryComments ?? {};
