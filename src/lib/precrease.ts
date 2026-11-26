/**
 * Precrease's content, ready for pages: published posts newest first, checked once per build.
 * Drafts show in `astro dev` so they can be previewed, and never in a build.
 *
 * A post can exist in several languages (M5.4): the original in the default language, and an
 * edition per other language with a slug of its own (checkEditions, precrease-tree.ts). Lists ask
 * for a language with getPosts(lang) and get one entry per post: that language's edition, or the
 * original while there is none. Routes that build every edition use getEditions().
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { copyFor } from '../i18n/dictionary';
import { DEFAULT_LANG, localize, type Lang, type Translations } from '../i18n/routing';
import { formatsFor } from './taxonomy';
import { padNumber } from './format';
import { fill } from './template';
import { checkEditions, checkNumbers, isLive, staleEditions } from './precrease-tree';

export type Post = CollectionEntry<'precrease'>;

/** Flattened shape the pure helpers in precrease-tree.ts work with. */
export interface PostSummary {
  /** This edition's slug, the last part of its URL. */
  id: string;
  /**
   * The original's slug, shared by every edition of the post: it seeds the thumbnail, and keys the
   * reader counts and the comments, so a post read in two languages is still one post.
   */
  key: string;
  lang: Lang;
  number: number;
  topics: string[];
  date: Date;
  /** Published: not a draft and its date has arrived. Only `astro dev` ever sees other posts. */
  live: boolean;
  entry: Post;
  /** Where each edition of the post this build has lives (the language switch, hreflang). */
  translations: Translations;
}

/**
 * Preview builds (`pnpm preview:upload`) include drafts and scheduled posts, so they can be read on
 * a real device through a Cloudflare preview URL before they're published. Those posts get
 * `noindex`. The production deploy never sets this.
 */
export const PREVIEW = process.env.PRECREASE_PREVIEW === '1';

/** One clock per build, so every page agrees on what is out. */
const buildTime = new Date();

const editionPath = (slug: string, lang: Lang) => localize(`/precrease/${slug}`, lang);

const readEditions = async (): Promise<PostSummary[]> => {
  const entries = await getCollection('precrease');
  const files = entries.map((entry) => {
    const parts = entry.id.split('/');
    return { entry, id: parts.at(-1)!, folder: parts.length > 1 ? parts[0]! : '' };
  });
  checkEditions(
    files.map(({ entry, id, folder }) => ({ id, folder, ...entry.data })),
    DEFAULT_LANG,
  );
  for (const { edition, original } of staleEditions(
    files.map(({ entry, id }) => ({ id, ...entry.data })),
    DEFAULT_LANG,
  ))
    console.warn(
      `Precrease: "${original}" was updated after its edition "${edition}"; the edition may need the same change (then set its \`updated\`).`,
    );
  const originalLive = new Map(
    files
      .filter((f) => f.entry.data.lang === DEFAULT_LANG)
      .map((f) => [f.id, isLive(f.entry.data, buildTime)]),
  );
  const editions = files
    .map(({ entry, id }) => {
      const key = entry.data.translationOf ?? id;
      return {
        id,
        key,
        lang: entry.data.lang,
        number: entry.data.number,
        topics: entry.data.topics,
        date: entry.data.date,
        // An edition is out only once its original is.
        live: isLive(entry.data, buildTime) && originalLive.get(key) === true,
        entry,
        translations: {} as Translations,
      };
    })
    .filter((p) => import.meta.env.DEV || PREVIEW || p.live);
  for (const p of editions) {
    for (const other of editions.filter((o) => o.key === p.key)) {
      p.translations[other.lang] = editionPath(other.id, other.lang);
    }
  }
  return editions;
};

let built: Promise<PostSummary[]> | undefined;

/**
 * Every edition of every post in this build, in every language. Read once per build, since every
 * page asks; `astro dev` reads it each time so edits show up.
 */
export const getEditions = (): Promise<PostSummary[]> =>
  import.meta.env.DEV ? readEditions() : (built ??= readEditions());

/** One entry per post, newest first: its edition in `lang`, or the original while it has none. */
export const getPosts = async (lang: Lang = DEFAULT_LANG): Promise<PostSummary[]> => {
  const editions = await getEditions();
  const originals = editions.filter((p) => p.lang === DEFAULT_LANG);
  // Drafts and scheduled posts may hold a future number; the sequence rule applies to what is out.
  checkNumbers(originals.filter((p) => p.live));
  return originals
    .map((o) => editions.find((p) => p.key === o.key && p.lang === lang) ?? o)
    .sort((a, b) => b.number - a.number);
};

/** "Crease No. 001", worded by the copy file of the page's language. */
export const creaseNumber = (value: number, lang: Lang = DEFAULT_LANG): string =>
  fill(copyFor(lang).precrease.number, { number: padNumber(value) });

/**
 * What kind of post it is, in words: "Essay", or "Basic Folds · part 3" inside a series. Numbers
 * always carry their word, so a series part never reads like the post's own number (Crease No.)
 * or a book's chapter.
 */
export const postKind = (post: Post, lang: Lang = DEFAULT_LANG): string => {
  const { format, series } = post.data;
  const kind = formatsFor(lang)[format].label;
  return series ? fill(copyFor(lang).precrease.part, { kind, part: series.part }) : kind;
};

/** Where a post's edition lives: /precrease/<slug>, /es/precrease/<slug>. */
export const postHref = (post: Pick<PostSummary, 'id' | 'lang'>) => editionPath(post.id, post.lang);
export const topicHref = (id: string, lang: Lang = DEFAULT_LANG) => localize(`/precrease/topics/${id}`, lang);
