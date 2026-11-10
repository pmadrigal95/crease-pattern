import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Notes (the blog). The taxonomy is validated at build time: a wrong category,
 * subcategory or translation link fails the build instead of reaching production.
 * See portfolio-discovery/11-blog-escalable.md for the reasoning.
 */
export const categories = {
  architecture: ['component-systems', 'state', 'monorepos', 'testing'],
  performance: ['rendering', 'network', 'web-vitals'],
  accessibility: ['keyboard', 'screen-readers', 'color'],
  motion: ['animation', 'microinteractions', '3d'],
  systems: ['concurrency', 'webassembly', 'workers'],
  craft: ['ai-assisted-dev', 'leadership', 'writing'],
} as const;

type Category = keyof typeof categories;
const categoryNames = Object.keys(categories) as [Category, ...Category[]];

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z
    .object({
      title: z.string().max(90),
      description: z.string().max(200),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      type: z.enum(['essay', 'note', 'til']),
      category: z.enum(categoryNames),
      subcategory: z.string().optional(),
      tags: z.array(z.string().toLowerCase()).default([]),
      series: z.object({ id: z.string(), part: z.number().int().positive() }).optional(),
      lang: z.enum(['en', 'es']).default('en'),
      translationOf: z.string().optional(),
      draft: z.boolean().default(false),
    })
    .refine((n) => !n.subcategory || (categories[n.category] as readonly string[]).includes(n.subcategory), {
      message: 'subcategory must belong to its category',
      path: ['subcategory'],
    }),
});

/**
 * The site owner's public profile: the only place personal data lives, so code stays
 * free of it. The schema is strict on purpose: an unexpected field (a phone number,
 * an address) fails the build instead of being published.
 */
const profile = defineCollection({
  loader: file('./src/content/profile.json'),
  schema: z.strictObject({
    name: z.string().min(1),
    role: z.string().min(1),
    location: z.string().min(1),
    training: z.string().min(1),
    languages: z.array(z.string().min(1)).min(1),
    summary: z.string().max(160),
    contact: z.strictObject({
      email: z.email(),
      linkedin: z.url().startsWith('https://www.linkedin.com/in/'),
      github: z.url().startsWith('https://github.com/'),
    }),
  }),
});

/** Standalone pages written in MDX (About, Colophon). */
const pages = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/pages' }),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().max(160),
  }),
});

export const collections = { notes, profile, pages };
