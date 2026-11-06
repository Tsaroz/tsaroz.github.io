# NepalRanks

**Live:** https://nepalranks.com

SEO-heavy, fully static buying guides and rankings for Nepal — authored from a
portable, local-only admin panel. No database, no backend, no cloud: just
Astro → GitHub Pages.

---

## Architecture

```
 content author (you, on your laptop)
        │  npm run admin  →  http://127.0.0.1:4322  (local editor UI)
        ▼
 src/content/articles/*.md   +   public/images/**
        │  git commit & push
        ▼
 GitHub Actions  →  npm run build  →  dist/
        │
        ▼
 GitHub Pages  →  https://nepalranks.com   (fully static HTML)
```

| Layer | Tech | Cost |
|---|---|---|
| Public site | Astro static → GitHub Pages, custom domain | free |
| Content | Markdown files + frontmatter (git-versioned) | free |
| Images | Files in `public/images`, referenced by path | free |
| Admin panel | Local Node server (localhost only) + browser UI | free |

The source of truth is the **Markdown files in `src/content/articles/`**. They are
plain text, git-friendly and fully portable — clone the repo anywhere and you have
your entire site.

## Writing content

### Option A — the admin panel (recommended)

```bash
npm install
npm run admin      # opens http://127.0.0.1:4322
```

The editor lets you:

- Create / edit / delete articles, with **draft** and **featured** flags
- Filter the list by All / Published / Drafts, and search by title, slug or category
- Fill in title, SEO description, category, dates, keywords
- Set a cover image (with live thumbnail) and add images anywhere in the body
- Add **product picks** (name, brand, price, image, summary, specs)
- Configure the **comparison table** columns
- Write the intro, Markdown body and conclusion
- Browse and upload from an **image library** (click an image to copy its path)
- Open the article on the live dev preview with the **View** button
- **Publish** directly: the top bar shows unpublished changes and commits +
  pushes your articles and images to `main` in one click

It binds to `127.0.0.1` only and sends nothing anywhere except the explicit
**Publish** button, which runs `git add` (only `src/content` and `public/images`),
`git commit` and `git push` in this repo. Run `npm run dev` in a second terminal
for live preview; drafts are visible there but never in the production build.

### Option B — edit Markdown directly

Each article is a file in `src/content/articles/`. The frontmatter schema:

```yaml
---
title: "Best Electric Scooter in Nepal (2026 Buyer's Guide)"
description: "SEO meta description"
slug: "best-electric-scooter-in-nepal"
category: "Buying Guides"
publishedAt: 2026-02-10
updatedAt: 2026-11-06
author: "NepalRanks Editorial"
coverImage: "/images/covers/best-electric-scooter-nepal.svg"
coverImageAlt: "…"
keywords: ["best electric scooter in Nepal"]
draft: false
featured: true
intro: "Opening paragraph shown before the product picks."
products:
  - name: "Niu NQi"
    brand: "Niu"
    price: "NPR 3,15,000"
    image: "/images/scooters/nio-es8.svg"
    imageAlt: "Niu NQi electric scooter"
    summary: "One-line verdict."
    specs:
      Range: "70–90 km"
      Top Speed: "45 km/h"
comparisonColumns:
  - key: price
    label: "Price"
  - key: Range
    label: "Range"
conclusion: "Closing paragraph shown in a highlighted box."
---

## Markdown body starts here

Use normal Markdown. Images: `![alt](/images/scooters/x.svg)`.
```

The page is assembled as: **intro → product cards ("Our picks at a glance") →
comparison table → Markdown body → conclusion**, plus an auto-generated table of
contents from your `##`/`###` headings.

## SEO built in

- Per-page `<title>`, meta description, canonical URL, Open Graph + Twitter cards
- `Article`, `BreadcrumbList` and `ItemList` JSON-LD structured data
- Sitemap (`@astrojs/sitemap`), `robots.txt`, fast static HTML
- Semantic headings, breadcrumbs, reading time

## Commands

```bash
npm run dev        # live preview at http://localhost:4321
npm run admin      # local content editor at http://127.0.0.1:4322
npm run build      # static build into dist/
npm run preview    # preview the production build
npm run check      # TypeScript + Astro diagnostics
```

## Deploying

Push to `main`. The GitHub Actions workflow
(`.github/workflows/site.yml`) builds the site and publishes `dist/` to GitHub
Pages automatically. Enable **Settings → Pages → Source: GitHub Actions** once
and set the custom domain `nepalranks.com`.

## Project layout

```
src/
  content/articles/    ← your articles (Markdown + frontmatter)
  content.config.ts    ← schema for the content collection
  components/          ← ProductCard, ComparisonTable, Toc
  layouts/             ← BaseLayout (chrome/SEO), ArticleLayout
  pages/               ← index, articles/, about, contact, privacy, terms, 404
  lib/articles.ts      ← collection helpers
  styles/global.css    ← design system
public/
  images/              ← cover and product images
admin/                 ← local editor UI (served by scripts/admin.mjs)
scripts/admin.mjs      ← the local admin server
```
