

const BASE = import.meta.env.BASE_URL ?? "/";

export function url(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith("mailto:")) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const base = BASE.replace(/\/$/, "");
  return `${base}${clean}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

const NOW = new Date();

export function timeAgo(iso: string): string {
  const diff = NOW.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 60) return `${Math.max(min, 1)} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function initials(name: string): string {
  const stop = new Set(["the", "of", "and", "in", "for", "a"]);
  const words = name.split(/\s+/).filter((w) => !stop.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
