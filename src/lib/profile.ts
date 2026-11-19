import { getEntry } from 'astro:content';
import { z } from 'astro/zod';
import { dictionary } from '../i18n/dictionary';

/**
 * What a page says about its owner: name and contact from the `profile` collection
 * (src/content.config.ts), role, location, training, languages and summary from the page's
 * language (src/i18n/locales/<lang>/profile.json). Components read personal data only through this.
 */
const wordsSchema = z.strictObject({
  role: z.string().min(1),
  location: z.string().min(1),
  training: z.string().min(1),
  languages: z.array(z.string().min(1)).min(1),
  summary: z.string().max(160),
});

export const getProfile = async (locale?: string | null) => {
  const entry = await getEntry('profile', 'owner');
  if (!entry) throw new Error('src/content/profile.json must define an "owner" entry.');
  return { ...entry.data, ...wordsSchema.parse(dictionary(locale).profile) };
};
