import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { formatIds, topicIds } from './config/precrease';

/**
 * Precrease (the blog, decisions 46–49). One MDX file per post in src/content/precrease.
 * The taxonomy lives in src/config/precrease.ts and is validated here: an unknown topic or
 * format fails the build instead of reaching production. Post numbers ("Crease No. 012")
 * are checked for gaps and duplicates in src/lib/precrease.ts.
 */
const precrease = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/precrease' }),
  schema: z
    .strictObject({
      /** Publication order: Crease No. 001, 002… Never reused. */
      number: z.number().int().positive(),
      title: z.string().max(90),
      description: z.string().max(200),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      format: z.enum(formatIds),
      /** One or more topics, at any depth of the tree. */
      topics: z.array(z.enum(topicIds)).min(1),
      series: z.strictObject({ id: z.string(), part: z.number().int().positive() }).optional(),
      /** Dog-ear posts name the book and chapter they comment on. */
      book: z
        .strictObject({
          title: z.string(),
          author: z.string(),
          year: z.number().int(),
          chapter: z.string().optional(),
          url: z.url(),
        })
        .optional(),
      /** Script for the vertical video made from this post (M9): hook, three beats, close. */
      reel: z
        .strictObject({
          hook: z.string().max(120),
          beats: z.array(z.string().max(160)).length(3),
          close: z.string().max(120),
        })
        .optional(),
      lang: z.enum(['en', 'es']).default('en'),
      translationOf: z.string().optional(),
      draft: z.boolean().default(false),
      /**
       * Interactive essays that run code on several threads need SharedArrayBuffer, which
       * browsers only allow on cross-origin isolated pages. True adds COOP/COEP to this post's
       * route (public/_headers, checked by tests/unit/guards.test.ts) and replaces embedded
       * comments with a link to GitHub, since isolation blocks the giscus frame.
       */
      isolated: z.boolean().default(false),
    })
    .refine((p) => (p.format === 'dog-ear') === Boolean(p.book), {
      message: 'Dog-ear posts need a book, and only Dog-ear posts have one',
      path: ['book'],
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

export const collections = { precrease, profile, pages };
