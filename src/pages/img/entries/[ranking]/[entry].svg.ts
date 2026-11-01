import type { APIRoute, GetStaticPaths } from "astro";
import { entries } from "@data/entries";
import { getRankingById } from "@data";
import { initials } from "@utils/url";

export const getStaticPaths = (async () =>
  entries.map((e) => ({
    params: { ranking: getRankingById(e.rankingId)?.slug ?? "unknown", entry: e.slug },
    props: { name: e.name, id: e.id },
  }))) satisfies GetStaticPaths;

const PALETTE = [
  "#142a6a", "#0c5c8a", "#145c4a", "#6b2737", "#7a4a12",
  "#43306b", "#25374a", "#1e46cc", "#0c8a5a", "#37517a",
];

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function tile(id: string, name: string): string {
  const h = hash(id);
  const bg = PALETTE[h % PALETTE.length];
  const rot = (h >> 4) % 30;
  const letters = initials(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${name}">
<rect width="160" height="160" rx="16" fill="${bg}"/>
<g transform="rotate(${rot} 80 80)" opacity="0.16" fill="none" stroke="#ffffff" stroke-width="2">
  <path d="M-40 110 Q40 40 120 100 T280 90"/>
  <path d="M-40 130 Q40 60 120 120 T280 110"/>
</g>
<text x="80" y="80" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700" fill="#ffffff">${letters}</text>
</svg>`;
}

export const GET: APIRoute = ({ props }) =>
  new Response(tile(props.id, props.name), {
    headers: { "Content-Type": "image/svg+xml" },
  });
