import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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

export const collections = { notes };
