import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const product = z.object({
  name: z.string(),
  brand: z.string().optional(),
  price: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  summary: z.string().optional(),
  specs: z.record(z.string(), z.string()).optional(),
});

const specColumn = z.object({
  key: z.string(),
  label: z.string(),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string().optional(),
    category: z.string().default("Guides"),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default("NepalRanks Editorial"),
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    intro: z.string().optional(),
    products: z.array(product).default([]),
    comparisonColumns: z.array(specColumn).default([]),
    conclusion: z.string().optional(),
  }),
});

export const collections = { articles };
