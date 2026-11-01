
import { authHeaders, sb, userRole } from "@lib/auth";

function cfg(): { url: string } | null {
  const el = document.getElementById("nr-live-config");
  if (!el) return null;
  try {
    const c = JSON.parse(el.textContent ?? "{}");
    return c.url ? { url: c.url } : null;
  } catch {
    return null;
  }
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = cfg();
  if (!c) throw new Error("no backend configured");
  const res = await fetch(`${c.url}/rest/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(await authHeaders()), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message ?? j.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function list<T>(table: string, query = "?select=*&order=updated_at.desc"): Promise<T[]> {
  return rest<T[]>(`/${table}${query}`);
}

export async function insert(table: string, row: unknown): Promise<void> {
  await rest(`/${table}?select=`, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
}

export async function update(table: string, filter: string, patch: object): Promise<void> {
  await rest(`/${table}?${filter}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(patch) });
}

export async function remove(table: string, filter: string): Promise<void> {
  await rest(`/${table}?${filter}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
}

export async function rpc<T = unknown>(fn: string, params: object): Promise<T> {
  return rest<T>(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(params) });
}

export async function requireStaff(): Promise<"admin" | "moderator"> {
  const role = await userRole();
  if (role !== "admin" && role !== "moderator") throw new Error("staff sign-in required");
  return role;
}

export { userRole };

export const nowIso = () => new Date().toISOString();
export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export type Cat = { id: string; name: string; slug: string; description: string; icon: string; created_at?: string; updated_at?: string };
export type Rk = { id: string; category_id: string; title: string; slug: string; description: string; cities: string[]; ad?: string; updated_at?: string };
export type En = { id: string; ranking_id: string; category_id: string; name: string; slug: string; description: string; upvotes: number; downvotes: number; updated_at?: string };
export type Ct = { slug: string; name: string; district?: string; description: string };
export type Cmt = { id: string; entry_id: string; author: string; body: string; status: string; created_at: string; email?: string; user_id?: string };
export type Settings = { ads: { enabled: boolean; code: Record<string, string> }; design: { theme: string; font: string; size: string; brand: string }; notices: Record<string, string> };

export async function getSettings(): Promise<Settings | null> {
  const rows = await rest<Array<{ key: string; value: Settings }>>("/cat_settings?key=eq.site&select=value");
  return rows?.[0]?.value ?? null;
}
export async function saveSettings(s: Settings): Promise<void> {
  await rest("/cat_settings", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "site", value: s }),
  });
}

let entryCache: Record<string, string> | null = null;
export async function entryNames(): Promise<Record<string, string>> {
  if (!entryCache) {
    const rows = await list<{ id: string; name: string }>("cat_entries", "?select=id,name");
    entryCache = Object.fromEntries(rows.map((r) => [r.id, r.name]));
  }
  return entryCache ?? {};
}
export function invalidateEntries() { entryCache = null; }

export { sb };
