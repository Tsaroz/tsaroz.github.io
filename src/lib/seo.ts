/**
 * Shared SEO engine.
 *
 * Pure functions with no framework dependencies. Used by the Astro build to
 * bake structured data and meta tags into the static HTML, and (byte-for-byte
 * the same logic) by the authoring UI to preview and score a page before
 * publishing.
 */

export interface SeoProduct {
  name: string;
  brand?: string;
  price?: string;
  image?: string;
  imageAlt?: string;
  summary?: string;
  specs?: Record<string, string>;
}

export interface SeoColumn {
  key: string;
  label: string;
}

export interface SeoInput {
  title: string;
  description: string;
  slug?: string;
  category?: string;
  publishedAt: string | Date;
  updatedAt?: string | Date;
  author?: string;
  coverImage?: string;
  coverImageAlt?: string;
  keywords?: string[];
  intro?: string;
  conclusion?: string;
  products?: SeoProduct[];
  comparisonColumns?: SeoColumn[];
  body?: string;
}

export interface SeoIssue {
  id: string;
  level: "error" | "warn" | "ok";
  label: string;
  detail: string;
}

export interface SeoAnalysis {
  score: number;
  issues: SeoIssue[];
  titleLength: number;
  descriptionLength: number;
  wordCount: number;
  readingTime: number;
  keywordDensity: Record<string, number>;
  headings: { h2: number; h3: number };
  imagesMissingAlt: number;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function stripMarkdown(md: string): string {
  return String(md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(md: string): number {
  const text = stripMarkdown(md);
  return text ? text.split(/\s+/).length : 0;
}

export function readingMinutes(md: string): number {
  return Math.max(1, Math.round(countWords(md) / 200));
}

/** Approximate how Google may truncate a title (pixel-ish weighting). */
export function titleDisplayLength(title: string): number {
  let w = 0;
  for (const ch of title) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1;
  return w;
}

export function countHeadings(md: string) {
  let h2 = 0;
  let h3 = 0;
  for (const line of String(md ?? "").split("\n")) {
    const m = /^(#{2,3})\s+/.exec(line);
    if (!m) continue;
    if (m[1].length === 2) h2++;
    else h3++;
  }
  return { h2, h3 };
}

export function imagesMissingAlt(md: string): number {
  let missing = 0;
  const re = /!\[([^\]]*)\]\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(md ?? "")))) {
    if (!m[1].trim()) missing++;
  }
  return missing;
}

export function keywordDensity(md: string, keywords: string[]): Record<string, number> {
  const text = stripMarkdown(md).toLowerCase();
  const words = text ? text.split(/\s+/) : [];
  const total = words.length || 1;
  const out: Record<string, number> = {};
  for (const kw of keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)) {
    if (!kw) continue;
    const parts = kw.split(/\s+/);
    let count = 0;
    for (let i = 0; i <= words.length - parts.length; i++) {
      let hit = true;
      for (let j = 0; j < parts.length; j++) {
        if (words[i + j] !== parts[j]) {
          hit = false;
          break;
        }
      }
      if (hit) count++;
    }
    out[kw] = +((count / total) * 100).toFixed(2);
  }
  return out;
}

export function analyzeSeo(input: SeoInput): SeoAnalysis {
  const body = input.body ?? "";
  const words = countWords([input.intro, body, input.conclusion].filter(Boolean).join(" "));
  const title = input.title ?? "";
  const description = input.description ?? "";
  const keywords = input.keywords ?? [];
  const products = input.products ?? [];
  const headings = countHeadings(body);
  const missingAlt = imagesMissingAlt(body);
  const density = keywordDensity([input.intro, body, input.conclusion].filter(Boolean).join(" "), keywords);

  const issues: SeoIssue[] = [];
  const add = (id: string, level: SeoIssue["level"], label: string, detail: string, points = 0) => {
    issues.push({ id, level, label, detail });
    return points;
  };

  let score = 100;

  const tLen = titleDisplayLength(title);
  if (!title) score -= add("title", "error", "Title missing", "Add a page title.", 20);
  else if (tLen > 60) score -= add("title-long", "warn", "Title is long", `${tLen} characters — Google truncates around 60.`);
  else if (tLen < 30) score -= add("title-short", "warn", "Title is short", `${tLen} characters — aim for 30–60.`);
  else add("title-ok", "ok", "Title length is good", `${tLen} characters.`);

  const dLen = description.length;
  if (!description) score -= add("desc", "error", "Description missing", "Add a meta description.", 15);
  else if (dLen > 160) score -= add("desc-long", "warn", "Description is long", `${dLen} characters — aim for 120–160.`);
  else if (dLen < 70) score -= add("desc-short", "warn", "Description is short", `${dLen} characters — aim for 120–160.`);
  else add("desc-ok", "ok", "Description length is good", `${dLen} characters.`);

  if (words < 300) score -= add("thin", "warn", "Thin content", `${words} words — guides do best above 600.`, 10);
  else add("words-ok", "ok", "Content depth is good", `${words} words.`);

  if (!keywords.length) score -= add("kw", "warn", "No keywords", "Add at least one target keyword.", 5);
  else {
    const primary = keywords[0]?.toLowerCase() ?? "";
    if (primary && !title.toLowerCase().includes(primary.split(/\s+/)[0])) {
      score -= add("kw-title", "warn", "Primary keyword not in title", `“${keywords[0]}” is not reflected in the title.`, 5);
    } else {
      add("kw-title-ok", "ok", "Primary keyword in title", "Good match.");
    }
  }

  if (headings.h2 < 2) score -= add("headings", "warn", "Few subheadings", "Use at least two H2 sections.", 5);
  else add("headings-ok", "ok", "Heading structure", `${headings.h2} H2, ${headings.h3} H3.`);

  if (missingAlt > 0) score -= add("alt", "warn", "Images missing alt text", `${missingAlt} image(s) have empty alt.`, 5);
  else if (/!\[/.test(body)) add("alt-ok", "ok", "All images have alt text", "Good accessibility signal.");

  if (!input.coverImage) score -= add("cover", "warn", "No cover image", "A cover image improves social sharing.", 5);
  else add("cover-ok", "ok", "Cover image set", input.coverImageAlt ? "Alt text present." : "Consider adding alt text.");

  if (products.length && !(input.comparisonColumns ?? []).length) {
    score -= add("compare", "warn", "No comparison columns", "You have products but no comparison table.", 5);
  }

  const slug = input.slug ?? slugify(title);
  if (slug.length > 75) score -= add("slug-long", "warn", "Slug is long", `${slug.length} characters.`, 5);
  if (!input.updatedAt) score -= add("updated", "warn", "No updated date", "Set an updated date to show freshness.", 3);

  return {
    score: clamp(Math.round(score)),
    issues,
    titleLength: tLen,
    descriptionLength: dLen,
    wordCount: words,
    readingTime: readingMinutes(body),
    keywordDensity: density,
    headings,
    imagesMissingAlt: missingAlt,
  };
}

// ---------------------------------------------------------------------------
// Structured data (JSON-LD), generated on-device at build time.
// ---------------------------------------------------------------------------

export interface SiteContext {
  origin: string;
  siteName: string;
  logo: string;
}

function abs(origin: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, origin).href;
}

export function buildArticleJsonLd(input: SeoInput, ctx: SiteContext) {
  const published = new Date(input.publishedAt).toISOString();
  const modified = new Date(input.updatedAt ?? input.publishedAt).toISOString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    image: input.coverImage ? [abs(ctx.origin, input.coverImage)] : [abs(ctx.origin, "og.png")],
    datePublished: published,
    dateModified: modified,
    author: { "@type": "Organization", name: input.author ?? ctx.siteName },
    publisher: {
      "@type": "Organization",
      name: ctx.siteName,
      logo: { "@type": "ImageObject", url: abs(ctx.origin, ctx.logo) },
    },
    mainEntityOfPage: abs(ctx.origin, `/articles/${input.slug ?? slugify(input.title)}/`),
    ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
  };
}

export function buildBreadcrumbJsonLd(input: SeoInput, ctx: SiteContext) {
  const slug = input.slug ?? slugify(input.title);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: abs(ctx.origin, "/") },
      { "@type": "ListItem", position: 2, name: "Articles", item: abs(ctx.origin, "/articles/") },
      { "@type": "ListItem", position: 3, name: input.title, item: abs(ctx.origin, `/articles/${slug}/`) },
    ],
  };
}

export function buildItemListJsonLd(input: SeoInput) {
  const products = input.products ?? [];
  if (!products.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      ...(p.price ? { description: `${p.name} — ${p.price}` } : {}),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Build FAQPage JSON-LD from an explicit list of Q&A pairs. */
export function buildFaqJsonLd(items: FaqItem[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

export interface SocialPreview {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
}

export function buildSocialPreview(input: SeoInput, ctx: SiteContext): SocialPreview {
  const slug = input.slug ?? slugify(input.title);
  return {
    title: input.title,
    description: input.description,
    url: abs(ctx.origin, `/articles/${slug}/`),
    image: input.coverImage ? abs(ctx.origin, input.coverImage) : abs(ctx.origin, "og.png"),
    siteName: ctx.siteName,
  };
}
