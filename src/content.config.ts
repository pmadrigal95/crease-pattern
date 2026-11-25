import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { formatIds, topicIds } from './config/precrease';
import { DEFAULT_LANG, LANGS } from './i18n/config';

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
      /**
       * What the post draws on (`source`) and where to keep learning (`further`), shown at the end
       * of the post. Every link is opened and checked by hand before it's added; HTTPS only.
       */
      references: z
        .array(
          z.strictObject({
            title: z.string().min(1),
            author: z.string().optional(),
            year: z.number().int().optional(),
            url: z.url().startsWith('https://'),
            /** One line on why it's here. */
            note: z.string().max(160).optional(),
            kind: z.enum(['source', 'further']),
            /**
             * The title's language when it isn't the post's (an English book cited in a Spanish
             * edition), so screen readers pronounce it right. A BCP 47 tag: "en", "ja".
             */
            lang: z
              .string()
              .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
              .optional(),
          }),
        )
        .optional(),
      /** Script for the vertical video made from this post (M9): hook, three beats, close. */
      reel: z
        .strictObject({
          hook: z.string().max(120),
          beats: z.array(z.string().max(160)).length(3),
          close: z.string().max(120),
        })
        .optional(),
      lang: z.enum(LANGS).default(DEFAULT_LANG),
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
 * free of it. What is said about the owner (role, summary…) is per language, in
 * src/i18n/locales/<lang>/profile.json; src/lib/profile.ts joins the two. The schema is strict on purpose: an unexpected field (a phone number,
 * an address) fails the build instead of being published.
 */
const cityDegrees = (limit: number) =>
  z
    .number()
    .min(-limit)
    .max(limit)
    .refine((v) => Math.round(v * 100) / 100 === v, 'Two decimals at most: a city, never an address.');
const profile = defineCollection({
  loader: file('./src/content/profile.json'),
  schema: z.strictObject({
    name: z.string().min(1),
    contact: z.strictObject({
      email: z.email(),
      linkedin: z.url().startsWith('https://www.linkedin.com/in/'),
      github: z.url().startsWith('https://github.com/'),
    }),
    // The owner's city, shown as coordinates under the home page's byline. Two decimals at most
    // (about a kilometre), so it can only ever name a city, never an address.
    city: z.strictObject({ lat: cityDegrees(90), lon: cityDegrees(180) }),
  }),
});

/**
 * Standalone pages written in MDX (About, Colophon, Privacy): one folder per language, the same
 * file names in each (en/about.mdx, es/about.mdx). Read through src/lib/pages.ts.
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/pages' }),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().max(160),
  }),
});

/**
 * Case studies (M6): one file per case and language, src/content/cases/<lang>/<slug>.md, the same
 * slug in every language. Data only: the page draws every case the same way (src/pages/[...locale]/work).
 * A case says only what the company approved for publication, in the most conservative terms:
 * practices and outcomes, never tools, stack, implementation, past problems or security detail.
 * The editorial rule is four plates and a short closing one; the schema holds it.
 */
/** The figures a plate can draw (src/components/work/figures). */
const figureKinds = ['arch', 'deploy', 'review', 'decisions', 'system', 'gates', 'layers', 'port'] as const;

const plate = z.strictObject({
  /** Anchor id, unique within its case. */
  id: z.string().regex(/^[a-z-]+$/),
  /** The local index's label. */
  short: z.string().max(24),
  title: z.string().max(60),
  goal: z.string().max(220),
  approach: z.string().max(520),
  result: z.string().max(260),
  /** The practice it shows, in the title block (never a tool). */
  practice: z.string().max(48),
  figure: z.enum(figureKinds),
  /** The figure's words, in this language. */
  labels: z.record(z.string(), z.string().max(48)),
  /** The case's lead plate: first, drawn larger. */
  lead: z.boolean().default(false),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.strictObject({
    company: z.string().min(1),
    role: z.string().min(1),
    /** A job, or a project of Pablo's own; jobs are listed first. */
    kind: z.enum(['role', 'project']).default('role'),
    /** When the work started; a case with an end date is a past job. */
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    title: z.string().max(80),
    /** One line for the card in /work and on the home page. */
    summary: z.string().max(120),
    lede: z.string().max(320),
    facts: z.array(z.strictObject({ label: z.string(), value: z.string() })).max(5),
    plates: z.array(plate).length(4),
    brief: z.strictObject({
      title: z.string().max(40),
      short: z.string().max(24),
      items: z.array(z.strictObject({ title: z.string().max(40), text: z.string().max(240) })).length(3),
    }),
  }),
});

export const collections = { precrease, profile, pages, cases };
