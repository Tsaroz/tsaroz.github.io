# NepalRanks

**Live:** https://nepalranks.com

Independent buying guides and rankings for products and services in Nepal.
Built with [Astro](https://astro.build) and deployed as fully static HTML.

---

## Stack

- **Astro** — static site generation, zero client-side framework
- **Markdown content collections** — type-checked frontmatter, versioned in git
- **GitHub Pages** — static hosting with a custom domain
- **SEO** — canonical URLs, Open Graph / Twitter cards, JSON-LD structured data,
  sitemap and robots.txt generated at build time

## Project layout

```
src/
  content/articles/    articles (Markdown + frontmatter)
  content.config.ts    content schema
  components/          ProductCard, ComparisonTable, Toc
  layouts/             BaseLayout (chrome/SEO), ArticleLayout
  pages/               index, articles/, about, contact, privacy, terms, 404
  lib/articles.ts      collection helpers
  styles/global.css    design system
public/
  images/              cover and product images
```

## Commands

```bash
npm install
npm run dev        # local preview at http://localhost:4321
npm run build      # static build into dist/
npm run preview    # preview the production build
npm run check      # TypeScript + Astro diagnostics
```

## Content

Articles are Markdown files in `src/content/articles/`. Each file starts with a
YAML frontmatter block that carries the metadata used to generate the page and
its structured data:

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
comparisonColumns:
  - key: "price"
    label: "Price"
conclusion: "Closing paragraph shown in a highlighted box."
faqs:
  - question: "Which one should I buy?"
    answer: "A short, direct answer."
noindex: false
---

## Markdown body starts here
```

The page is assembled as: **intro → product picks → comparison table → Markdown
body → conclusion**, with an auto-generated table of contents.

## Deploying

Push to `main`. The GitHub Actions workflow (`.github/workflows/site.yml`)
builds the site and publishes `dist/` to GitHub Pages.

## License

Content and images © NepalRanks. All rights reserved.
